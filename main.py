from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlglot
from sqlglot.expressions import CTE, Table, Join, Alias, Column

app = FastAPI(title="Enhanced SQL Lineage API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


class SQLRequest(BaseModel):
    sql: str
    dialect: str = "bigquery"


def extract_columns(select_expression):
    """Helper to extract column names/aliases from a SELECT block"""
    cols = []
    for exp in select_expression.expressions:
        if isinstance(exp, Alias):
            cols.append(exp.alias)
        elif isinstance(exp, Column):
            cols.append(exp.name)
    return cols


# @app.post("/api/parse-sql")
# def parse_sql(request: SQLRequest):
#     ast = sqlglot.parse_one(request.sql, read=request.dialect)
#     nodes_dict = {}
#     edges = []
#
#     def add_node(n_id, label, n_type="tableNode", cols=None):
#         if n_id not in nodes_dict:
#             nodes_dict[n_id] = {"id": n_id, "data": {"label": label, "columns": cols or []}, "type": n_type}
#
#     # Process CTEs
#     for cte in ast.find_all(CTE):
#         cte_name = cte.alias
#         cols = extract_columns(cte.this)
#         add_node(cte_name, cte_name, "tableNode", cols)
#
#         tables = [t.name for t in cte.this.find_all(Table)]
#         joins = list(cte.this.find_all(Join))
#
#         if joins and len(tables) > 1:
#             # Create an interim JOIN node
#             join_node_id = f"join_{cte_name}"
#             add_node(join_node_id, f"JOIN ({len(tables)} tables)", "joinNode")
#
#             # Connect tables to the JOIN node, then JOIN node to the CTE
#             for t_name in tables:
#                 add_node(t_name, t_name, "tableNode")
#                 edges.append(
#                     {"id": f"e-{t_name}-{join_node_id}", "source": t_name, "target": join_node_id, "animated": True,
#                      "style": {"stroke": '#9CA3AF'}})
#
#             edges.append(
#                 {"id": f"e-{join_node_id}-{cte_name}", "source": join_node_id, "target": cte_name, "animated": True,
#                  "style": {"stroke": '#4F46E5', "strokeWidth": 2}})
#         else:
#             # Direct connection if no joins
#             for t_name in tables:
#                 add_node(t_name, t_name, "tableNode")
#                 edges.append({"id": f"e-{t_name}-{cte_name}", "source": t_name, "target": cte_name, "animated": True,
#                               "style": {"stroke": '#4F46E5', "strokeWidth": 2}})

@app.post("/api/parse-sql")
def parse_sql(request: SQLRequest):
    ast = sqlglot.parse_one(request.sql, read=request.dialect)
    nodes_dict = {}
    edges = []

    # Added 'conditions' parameter to our node helper
    def add_node(n_id, label, n_type="tableNode", cols=None, conditions=None):
        if n_id not in nodes_dict:
            nodes_dict[n_id] = {
                "id": n_id,
                "data": {
                    "label": label,
                    "columns": cols or [],
                    "conditions": conditions or []  # Store JOIN conditions here
                },
                "type": n_type
            }

    for cte in ast.find_all(CTE):
        cte_name = cte.alias
        cols = extract_columns(cte.this)
        add_node(cte_name, cte_name, "tableNode", cols=cols)

        tables = [t.name for t in cte.this.find_all(Table)]
        joins = list(cte.this.find_all(Join))

        if joins and len(tables) > 1:
            # --- NEW: Extract JOIN conditions ---
            join_conditions = []
            for j in joins:
                if j.args.get("on"):
                    join_conditions.append(j.args["on"].sql(dialect=request.dialect))
                elif j.args.get("using"):
                    # Some dialects use USING (col_name) instead of ON
                    join_conditions.append(f"USING {j.args['using'].sql(dialect=request.dialect)}")

            join_node_id = f"join_{cte_name}"
            # Pass conditions to the node
            add_node(join_node_id, f"JOIN ({len(tables)} tables)", "joinNode", conditions=join_conditions)

            for t_name in tables:
                add_node(t_name, t_name, "tableNode")
                edges.append({"id": f"e-{t_name}-{join_node_id}", "source": t_name, "target": join_node_id})

            edges.append({"id": f"e-{join_node_id}-{cte_name}", "source": join_node_id, "target": cte_name})
        else:
            for t_name in tables:
                add_node(t_name, t_name, "tableNode")
                edges.append({"id": f"e-{t_name}-{cte_name}", "source": t_name, "target": cte_name})

    main_query = ast.copy()
    main_query.set("with", None)
    out_cols = extract_columns(main_query)
    add_node("Final_Output", "Final View Output", "tableNode", cols=out_cols)

    for t in main_query.find_all(Table):
        edges.append({"id": f"e-{t.name}-Final_Output", "source": t.name, "target": "Final_Output"})

    return {"nodes": list(nodes_dict.values()), "edges": edges}
    # Process Final Output
    main_query = ast.copy()
    main_query.set("with", None)
    out_cols = extract_columns(main_query)
    add_node("Final_Output", "Final View Output", "tableNode", out_cols)

    for t in main_query.find_all(Table):
        edges.append({"id": f"e-{t.name}-Final_Output", "source": t.name, "target": "Final_Output", "animated": True,
                      "style": {"stroke": '#4F46E5', "strokeWidth": 2}})

    return {"nodes": list(nodes_dict.values()), "edges": edges}