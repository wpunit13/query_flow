from pathlib import Path

import pytest
import sqlglot

from backend.services.lineage_parser import parse_sql_to_lineage


NOTWORKING_SQL = Path(__file__).resolve().parent / "fixtures" / "notworking.sql"


def _node(result, node_id):
    return next(n for n in result["nodes"] if n["id"] == node_id)


def test_simple_select_without_cte():
    result = parse_sql_to_lineage("SELECT id FROM users")
    node_ids = {n["id"] for n in result["nodes"]}
    assert "users" in node_ids
    assert "Final_Output" in node_ids
    assert _node(result, "Final_Output")["data"]["kind"] == "final_output"


def test_cte_query():
    sql = "WITH cte1 AS (SELECT * FROM users) SELECT * FROM cte1"
    result = parse_sql_to_lineage(sql)
    node_ids = {n["id"] for n in result["nodes"]}
    assert "cte1" in node_ids
    assert "users" in node_ids
    assert "Final_Output" in node_ids
    assert _node(result, "cte1")["data"]["kind"] == "cte"
    assert _node(result, "users")["data"]["kind"] == "physical_table"


def test_join_query():
    sql = "SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id"
    result = parse_sql_to_lineage(sql)
    node_ids = {n["id"] for n in result["nodes"]}
    assert "users" in node_ids
    assert "orders" in node_ids
    join_nodes = [n for n in result["nodes"] if n["type"] == "joinNode"]
    assert len(join_nodes) == 1
    assert join_nodes[0]["data"]["join_type"] == "INNER JOIN"


def test_notworking_sql_file():
    sql = NOTWORKING_SQL.read_text()
    result = parse_sql_to_lineage(sql)
    assert len(result["nodes"]) >= 10
    assert len(result["edges"]) >= 10
    assert result["version"] == "1.0"
    assert "stats" in result
    assert result["stats"]["node_count"] == len(result["nodes"])
    assert any("LATERAL" in w for w in result["warnings"])


def test_invalid_sql_raises():
    with pytest.raises(sqlglot.errors.ParseError):
        parse_sql_to_lineage("SELECT FROM")


def test_qualified_table_name():
    sql = "SELECT id FROM hr.employees"
    result = parse_sql_to_lineage(sql)
    emp = _node(result, "hr.employees")
    assert emp["data"]["qualified_name"] == "hr.employees"
    assert emp["data"]["schema"] == "hr"
    assert emp["data"]["kind"] == "physical_table"


def test_subquery_source_node():
    sql = "SELECT sq.id FROM (SELECT id FROM users) sq"
    result = parse_sql_to_lineage(sql)
    subquery_nodes = [n for n in result["nodes"] if n["data"]["kind"] == "subquery"]
    assert len(subquery_nodes) == 1
    assert "users" in {n["id"] for n in result["nodes"]}


def test_column_lineage_on_output():
    sql = "SELECT u.id, o.amount FROM users u JOIN orders o ON u.id = o.user_id"
    result = parse_sql_to_lineage(sql)
    output = _node(result, "Final_Output")
    lineage = output["data"]["column_lineage"]
    assert len(lineage) == 2
    amount_entry = next(e for e in lineage if e["name"] == "amount")
    assert any("orders" in src or "amount" in src for src in amount_entry["sources"])


def test_insert_statement():
    sql = "INSERT INTO target_tbl SELECT id FROM users"
    result = parse_sql_to_lineage(sql)
    assert _node(result, "target_tbl")["data"]["kind"] == "insert_target"
    assert "users" in {n["id"] for n in result["nodes"]}


def test_create_view_statement():
    sql = "CREATE VIEW my_view AS SELECT id FROM users"
    result = parse_sql_to_lineage(sql)
    assert _node(result, "my_view")["data"]["kind"] == "view"
    assert "users" in {n["id"] for n in result["nodes"]}


def test_merge_statement():
    sql = (
        "MERGE INTO target t USING source s ON t.id = s.id "
        "WHEN MATCHED THEN UPDATE SET val = s.val"
    )
    result = parse_sql_to_lineage(sql)
    merge_nodes = [n for n in result["nodes"] if n["data"]["kind"] == "merge_target"]
    assert len(merge_nodes) == 1
    assert "source" in {n["id"] for n in result["nodes"]}


def test_left_join_type_preserved():
    sql = "SELECT * FROM a LEFT JOIN b ON a.id = b.id"
    result = parse_sql_to_lineage(sql)
    join = next(n for n in result["nodes"] if n["type"] == "joinNode")
    assert join["data"]["join_type"] == "LEFT JOIN"
    assert join["data"]["join_order"] == 1


def test_lateral_preprocessing_warning():
    sql = (
        "SELECT e.id FROM employees e "
        "LEFT LATERAL (SELECT 1 FROM salaries s WHERE s.employee_id = e.id) sal ON TRUE"
    )
    result = parse_sql_to_lineage(sql)
    assert any("LATERAL" in w for w in result["warnings"])


def test_edges_have_type():
    result = parse_sql_to_lineage("SELECT id FROM users")
    assert all("edge_type" in e for e in result["edges"])


def test_union_all_cte_wires_branches():
    sql = """
    WITH comp_union AS (
        SELECT base_salary AS total_compensation FROM salaries
        UNION ALL
        SELECT amount AS total_compensation FROM bonuses
    )
    SELECT MAX(total_compensation) AS max_total FROM comp_union
    """
    result = parse_sql_to_lineage(sql)
    union_nodes = [n for n in result["nodes"] if n["data"]["kind"] == "union"]
    assert len(union_nodes) == 1
    union = union_nodes[0]
    assert union["data"]["union_type"] == "UNION ALL"
    assert union["data"]["branch_count"] == 2
    assert union["id"] == "union_comp_union_0"

    union_edges_in = [e for e in result["edges"] if e["target"] == union["id"]]
    sources = {e["source"] for e in union_edges_in}
    assert "salaries" in sources
    assert "bonuses" in sources
    assert all(e["edge_type"] == "union" for e in union_edges_in)

    assert any(
        e["source"] == union["id"] and e["target"] == "comp_union"
        for e in result["edges"]
    )


def test_recursive_cte_union_anchor_branch_connected():
    sql = """
    WITH RecursiveDepartmentHierarchy AS (
        SELECT d.department_id FROM departments d WHERE d.parent_department_id IS NULL
        UNION ALL
        SELECT d.department_id
        FROM departments d
        INNER JOIN RecursiveDepartmentHierarchy dh ON d.parent_department_id = dh.department_id
    )
    SELECT * FROM RecursiveDepartmentHierarchy
    """
    result = parse_sql_to_lineage(sql)
    union = next(n for n in result["nodes"] if n["id"] == "union_RecursiveDepartmentHierarchy_0")
    assert union["data"]["union_type"] == "UNION ALL"

    incoming = [e["source"] for e in result["edges"] if e["target"] == union["id"]]
    assert "departments" in incoming
    assert "join_RecursiveDepartmentHierarchy_1" in incoming


def test_join_operands_include_sql_aliases():
    sql = (
        "SELECT p.project_id FROM projects p "
        "INNER JOIN project_assignments pa ON p.project_id = pa.project_id"
    )
    result = parse_sql_to_lineage(sql)
    join = next(n for n in result["nodes"] if n["type"] == "joinNode")
    operands = join["data"]["join_operands"]
    assert len(operands) == 2
    assert operands[0]["side"] == "left"
    assert operands[1]["side"] == "right"
    assert "p" in operands[0]["label"]
    assert "projects" in operands[0]["label"]
    assert "pa" in operands[1]["label"]
    assert "project_assignments" in operands[1]["label"]
