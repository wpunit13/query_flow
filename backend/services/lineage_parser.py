import sqlglot
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlglot import lineage as sqlglot_lineage
from sqlglot.expressions import (
    Alias,
    Column,
    Create,
    CTE,
    Insert,
    Join,
    Merge,
    Select,
    Subquery,
    Table,
    Union,
)

from backend.services.sql_preprocessor import preprocess_sql

NODE_KINDS = frozenset(
    {"physical_table", "cte", "subquery", "view", "final_output", "merge_target", "insert_target"}
)


def extract_output_columns(select_expression) -> List[str]:
    """Extract output column names/aliases from a SELECT block."""
    if isinstance(select_expression, Union):
        expr = select_expression
        while isinstance(expr, Union):
            expr = expr.this
        select_expression = expr

    cols: List[str] = []
    for exp in select_expression.expressions:
        if isinstance(exp, Alias):
            cols.append(exp.alias)
        elif isinstance(exp, Column):
            cols.append(exp.name)
    return cols


def qualify_table(table: Table) -> Dict[str, Optional[str]]:
    """Extract catalog/database/schema/table parts from a Table expression."""
    catalog = table.catalog or None
    database = table.db or None
    name = table.name
    parts = [p for p in (catalog, database, name) if p]
    qualified_name = ".".join(parts) if parts else name
    return {
        "database": catalog,
        "schema": database,
        "name": name,
        "qualified_name": qualified_name,
    }


def format_join_type(join_expr: Join) -> str:
    side = (join_expr.side or "").upper()
    kind = (join_expr.kind or "INNER").upper()
    if side and side != "INNER":
        return f"{side} JOIN"
    return f"{kind} JOIN"


def join_condition_sql(join_expr: Join, dialect: str) -> Optional[str]:
    if join_expr.args.get("on"):
        return join_expr.args["on"].sql(dialect=dialect)
    if join_expr.args.get("using"):
        return f"USING {join_expr.args['using'].sql(dialect=dialect)}"
    return None


def get_from_join_steps(select_expr: Select) -> List[Tuple[Optional[Join], Any]]:
    """Return FROM/JOIN steps in order without flattening nested subqueries."""
    from_clause = select_expr.args.get("from_") or select_expr.args.get("from")
    if not from_clause:
        return []

    steps: List[Tuple[Optional[Join], Any]] = [(None, from_clause.this)]
    for join in select_expr.args.get("joins") or []:
        steps.append((join, join.this))
    return steps


def collect_union_selects(expression) -> List[Select]:
    """Collect SELECT branches from a UNION tree."""
    selects: List[Select] = []

    def walk(expr):
        if isinstance(expr, Union):
            walk(expr.this)
            walk(expr.expression)
        elif isinstance(expr, Select):
            selects.append(expr)

    walk(expression)
    return selects


def leaf_lineage_sources(node) -> List[str]:
    """Collect leaf source column references from a sqlglot lineage Node."""
    sources: List[str] = []

    def walk(n):
        if n.downstream:
            for child in n.downstream:
                walk(child)
        else:
            ref = n.name or ""
            if n.source is not None and isinstance(n.source, Table):
                table_name = n.source.name or ""
                col_name = n.name or ""
                if table_name and col_name and "." not in ref:
                    ref = f"{table_name}.{col_name}"
            if ref:
                sources.append(ref)

    walk(node)
    return sources


def build_column_lineage(output_columns: List[str], sql: str, dialect: str) -> List[Dict[str, Any]]:
    """Build column-level lineage for each output column using sqlglot.lineage."""
    entries: List[Dict[str, Any]] = []
    for col in output_columns:
        try:
            root = sqlglot_lineage.lineage(col, sql, dialect=dialect)
            sources = leaf_lineage_sources(root)
        except Exception:
            sources = []
        entries.append({"name": col, "sources": sources})
    return entries


class LineageGraphBuilder:
    """Builds a React Flow graph from a sqlglot AST."""

    def __init__(self, raw_sql: str, preprocessed_sql: str, dialect: str, warnings: List[str]):
        self.raw_sql = raw_sql
        self.sql = preprocessed_sql
        self.dialect = dialect
        self.warnings = list(warnings)
        self.nodes_dict: Dict[str, dict] = {}
        self.edges: List[dict] = []
        self.cte_names: Set[str] = set()
        self._subquery_counter = 0

    def add_edge(self, source: str, target: str, edge_type: str = "direct") -> None:
        edge_id = f"e-{source}-{target}"
        if any(e["id"] == edge_id for e in self.edges):
            return
        self.edges.append(
            {"id": edge_id, "source": source, "target": target, "edge_type": edge_type}
        )

    def add_node(
        self,
        node_id: str,
        label: str,
        node_type: str = "tableNode",
        kind: str = "physical_table",
        qualified_name: Optional[str] = None,
        schema: Optional[str] = None,
        database: Optional[str] = None,
        columns: Optional[List[str]] = None,
        conditions: Optional[List[str]] = None,
        join_type: Optional[str] = None,
        join_order: Optional[int] = None,
        column_lineage: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        if node_id in self.nodes_dict:
            existing = self.nodes_dict[node_id]
            if columns and not existing["data"]["columns"]:
                existing["data"]["columns"] = columns
            if column_lineage and not existing["data"]["column_lineage"]:
                existing["data"]["column_lineage"] = column_lineage
            return

        self.nodes_dict[node_id] = {
            "id": node_id,
            "type": node_type,
            "data": {
                "label": label,
                "columns": columns or [],
                "conditions": conditions or [],
                "kind": kind,
                "qualified_name": qualified_name,
                "schema": schema,
                "database": database,
                "dialect": self.dialect,
                "join_type": join_type,
                "join_order": join_order,
                "column_lineage": column_lineage or [],
            },
        }

    def register_source(self, source_expr, parent_target_id: str) -> str:
        """Register a FROM/JOIN source (table, CTE ref, or subquery) and return its node id."""
        if isinstance(source_expr, Table):
            qual = qualify_table(source_expr)
            name = qual["name"]
            if name in self.cte_names:
                self.add_node(
                    name,
                    name,
                    kind="cte",
                    qualified_name=name,
                    columns=None,
                )
                return name

            node_id = qual["qualified_name"] or name
            self.add_node(
                node_id,
                qual["qualified_name"] or name,
                kind="physical_table",
                qualified_name=qual["qualified_name"],
                schema=qual["schema"],
                database=qual["database"],
            )
            return node_id

        if isinstance(source_expr, Subquery):
            self._subquery_counter += 1
            sub_id = f"subquery_{parent_target_id}_{self._subquery_counter}"
            inner = source_expr.this
            alias = source_expr.alias
            label = alias or sub_id
            cols = extract_output_columns(inner) if isinstance(inner, (Select, Union)) else []
            self.add_node(sub_id, label, kind="subquery", columns=cols)
            if isinstance(inner, (Select, Union)):
                self.process_select_expression(inner, sub_id, "subquery")
            return sub_id

        if isinstance(source_expr, Join):
            return self.register_source(source_expr.this, parent_target_id)

        return f"unknown_{self._subquery_counter}"

    def process_select_expression(
        self, select_expr, target_id: str, target_kind: str, attach_lineage: bool = True
    ) -> None:
        """Process SELECT or UNION sources into join chains leading to target_id."""
        if isinstance(select_expr, Union):
            for branch in collect_union_selects(select_expr):
                self.process_select_block(branch, target_id, chain_to_target=False)
            if attach_lineage:
                cols = extract_output_columns(select_expr)
                lineage = build_column_lineage(cols, self.sql, self.dialect)
                self.add_node(
                    target_id,
                    self.nodes_dict[target_id]["data"]["label"],
                    kind=target_kind,
                    columns=cols,
                    column_lineage=lineage,
                )
            return

        if isinstance(select_expr, Select):
            self.process_select_block(select_expr, target_id, chain_to_target=True)
            if attach_lineage:
                cols = extract_output_columns(select_expr)
                lineage = build_column_lineage(cols, self.sql, self.dialect)
                if target_id in self.nodes_dict:
                    self.nodes_dict[target_id]["data"]["columns"] = cols
                    self.nodes_dict[target_id]["data"]["column_lineage"] = lineage

    def process_select_block(
        self, select_expr: Select, target_id: str, chain_to_target: bool = True
    ) -> None:
        """Walk FROM/JOIN chain with per-join nodes; avoid flattening subquery internals."""
        steps = get_from_join_steps(select_expr)
        if not steps:
            return

        prev_node_id: Optional[str] = None

        for index, (join_expr, source_expr) in enumerate(steps):
            source_id = self.register_source(source_expr, target_id)

            if join_expr is None:
                if len(steps) == 1 and chain_to_target:
                    self.add_edge(source_id, target_id, "direct")
                else:
                    prev_node_id = source_id
                continue

            join_order = index
            join_id = f"join_{target_id}_{join_order}"
            join_type = format_join_type(join_expr)
            condition = join_condition_sql(join_expr, self.dialect)
            conditions = [condition] if condition else []

            self.add_node(
                join_id,
                join_type,
                node_type="joinNode",
                kind="join",
                conditions=conditions,
                join_type=join_type,
                join_order=join_order,
            )

            if prev_node_id:
                self.add_edge(prev_node_id, join_id, "join")
            self.add_edge(source_id, join_id, "join")
            prev_node_id = join_id

        if chain_to_target and prev_node_id and prev_node_id != target_id:
            self.add_edge(prev_node_id, target_id, "direct")

    def process_ctes(self, ast) -> None:
        for cte in ast.find_all(CTE):
            self.cte_names.add(cte.alias)
            cols = extract_output_columns(cte.this)
            lineage = build_column_lineage(cols, self.sql, self.dialect)
            self.add_node(
                cte.alias,
                cte.alias,
                kind="cte",
                qualified_name=cte.alias,
                columns=cols,
                column_lineage=lineage,
            )
            self.process_select_expression(cte.this, cte.alias, "cte", attach_lineage=False)

    def process_insert(self, ast: Insert) -> None:
        target_table = ast.this
        qual = qualify_table(target_table)
        target_id = qual["qualified_name"] or qual["name"]
        cols = extract_output_columns(ast.expression) if ast.expression else []
        lineage = build_column_lineage(cols, self.sql, self.dialect) if cols else []

        self.add_node(
            target_id,
            qual["qualified_name"] or qual["name"],
            kind="insert_target",
            qualified_name=qual["qualified_name"],
            schema=qual["schema"],
            database=qual["database"],
            columns=cols,
            column_lineage=lineage,
        )

        if isinstance(ast.expression, (Select, Union)):
            self.process_select_expression(ast.expression, target_id, "insert_target")

    def process_create(self, ast: Create) -> None:
        target_table = ast.this
        qual = qualify_table(target_table)
        target_id = qual["qualified_name"] or qual["name"]
        expr = ast.expression

        cols = extract_output_columns(expr) if expr else []
        lineage = build_column_lineage(cols, self.sql, self.dialect) if cols else []

        self.add_node(
            target_id,
            qual["qualified_name"] or qual["name"],
            kind="view",
            qualified_name=qual["qualified_name"],
            schema=qual["schema"],
            database=qual["database"],
            columns=cols,
            column_lineage=lineage,
        )

        if isinstance(expr, (Select, Union)):
            self.process_select_expression(expr, target_id, "view")

    def process_merge(self, ast: Merge) -> None:
        target_table = ast.this
        target_qual = qualify_table(target_table)
        target_id = f"merge_{target_qual['qualified_name'] or target_qual['name']}"

        self.add_node(
            target_id,
            f"MERGE → {target_qual['qualified_name'] or target_qual['name']}",
            kind="merge_target",
            qualified_name=target_qual["qualified_name"],
            schema=target_qual["schema"],
            database=target_qual["database"],
        )

        using_expr = ast.args.get("using")
        if using_expr is not None:
            source_id = self.register_source(using_expr, target_id)
            on_sql = ast.args.get("on")
            join_id = f"join_{target_id}_0"
            conditions = [on_sql.sql(dialect=self.dialect)] if on_sql else []
            self.add_node(
                join_id,
                "MERGE ON",
                node_type="joinNode",
                kind="join",
                conditions=conditions,
                join_type="MERGE",
                join_order=0,
            )
            self.add_edge(source_id, join_id, "merge")
            self.add_edge(join_id, target_id, "merge")
        else:
            if using_expr:
                source_id = self.register_source(using_expr, target_id)
                self.add_edge(source_id, target_id, "merge")

    def process_select_root(self, ast: Select) -> None:
        cols = extract_output_columns(ast)
        lineage = build_column_lineage(cols, self.sql, self.dialect)
        self.add_node(
            "Final_Output",
            "Final View Output",
            kind="final_output",
            qualified_name="Final_Output",
            columns=cols,
            column_lineage=lineage,
        )

        query = ast.copy()
        query.set("with", None)
        self.process_select_expression(query, "Final_Output", "final_output", attach_lineage=False)

    def build(self, ast) -> Dict[str, Any]:
        self.process_ctes(ast)

        if isinstance(ast, Insert):
            self.process_insert(ast)
        elif isinstance(ast, Create) and ast.args.get("kind") == "VIEW":
            self.process_create(ast)
        elif isinstance(ast, Merge):
            self.process_merge(ast)
        elif isinstance(ast, Select):
            self.process_select_root(ast)
        else:
            self.warnings.append(
                f"Unsupported statement type '{type(ast).__name__}'; lineage may be incomplete."
            )
            if hasattr(ast, "find"):
                for sel in ast.find_all(Select):
                    if sel is not ast:
                        continue
                    self.process_select_root(sel)
                    break

        return {
            "version": "1.0",
            "warnings": self.warnings,
            "nodes": list(self.nodes_dict.values()),
            "edges": self.edges,
        }


def build_lineage_graph(sql: str, dialect: str = "bigquery") -> dict:
    """Parse SQL and return a React Flow-compatible lineage graph."""
    preprocessed, warnings = preprocess_sql(sql)
    ast = sqlglot.parse_one(preprocessed, read=dialect)
    builder = LineageGraphBuilder(sql, preprocessed, dialect, warnings)
    return builder.build(ast)


def parse_sql_to_lineage(sql: str, dialect: str = "bigquery") -> dict:
    """Parse SQL into lineage graph; raises sqlglot.errors.ParseError on failure."""
    return build_lineage_graph(sql, dialect)
