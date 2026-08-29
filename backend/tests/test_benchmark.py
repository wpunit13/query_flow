"""
Backend Performance & Micro-Benchmark Suite for QueryFlow Lineage Parser & API
Measures execution latency, throughput (queries/sec), and parsing overhead.
"""

import time
import os
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app import app
from backend.services.lineage_parser import parse_sql_to_lineage
from backend.services.export_formats import lineage_to_openlineage

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent / "fixtures"

# --- Test SQL Workloads ---
SIMPLE_SQL = "SELECT id, name, email FROM users WHERE active = true"

TWO_CTE_SQL = """
WITH active_users AS (
    SELECT id, name, dept_id FROM users WHERE active = true
),
dept_summary AS (
    SELECT dept_id, COUNT(*) as user_count FROM active_users GROUP BY dept_id
)
SELECT d.name as department_name, ds.user_count
FROM dept_summary ds
JOIN departments d ON ds.dept_id = d.id
"""

COMPLEX_MULTI_JOIN_SQL = """
WITH sales_ranked AS (
    SELECT 
        customer_id, 
        product_id, 
        amount,
        ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) as rn
    FROM sales
),
top_customers AS (
    SELECT customer_id, SUM(amount) as total_spent
    FROM sales_ranked
    WHERE rn <= 5
    GROUP BY customer_id
),
customer_profiles AS (
    SELECT tc.customer_id, tc.total_spent, c.first_name || ' ' || c.last_name as full_name, c.region
    FROM top_customers tc
    JOIN customers c ON tc.customer_id = c.id
)
SELECT cp.region, AVG(cp.total_spent) as avg_regional_spend, COUNT(*) as top_customer_count
FROM customer_profiles cp
GROUP BY cp.region
"""

def load_fixture_sql(filename: str) -> str:
    path = FIXTURES_DIR / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return COMPLEX_MULTI_JOIN_SQL

def benchmark(name: str, fn, min_runs: int = 30, max_time_sec: float = 0.5):
    # Warmup
    for _ in range(3):
        fn()

    latencies = []
    start = time.perf_counter()
    iterations = 0

    while (time.perf_counter() - start < max_time_sec) or iterations < min_runs:
        t0 = time.perf_counter()
        fn()
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1000.0)  # ms
        iterations += 1

    latencies.sort()
    total_time = sum(latencies)
    avg_ms = total_time / len(latencies)
    p50_ms = latencies[int(len(latencies) * 0.50)]
    p95_ms = latencies[int(len(latencies) * 0.95)]
    p99_ms = latencies[int(len(latencies) * 0.99)]
    ops_sec = int(iterations / (total_time / 1000.0))

    return {
        "name": name,
        "ops_sec": f"{ops_sec:,}",
        "avg_ms": f"{avg_ms:.3f} ms",
        "p50_ms": f"{p50_ms:.3f} ms",
        "p95_ms": f"{p95_ms:.3f} ms",
        "p99_ms": f"{p99_ms:.3f} ms",
    }

def run_backend_benchmarks():
    large_sql = load_fixture_sql("large_multifeature.sql")

    print("\n" + "=" * 80)
    print("⚡ QueryFlow Backend Benchmark Suite (SQLGlot Parser & API Engine)")
    print("=" * 80)

    results = []

    # 1. Core Lineage Parser Engine
    results.append(benchmark("Simple Query Parse (1 table)", lambda: parse_sql_to_lineage(SIMPLE_SQL)))
    results.append(benchmark("2-CTE Pipeline Parse (Snowflake)", lambda: parse_sql_to_lineage(TWO_CTE_SQL, dialect="snowflake")))
    results.append(benchmark("Window & Aggregation CTE Parse", lambda: parse_sql_to_lineage(COMPLEX_MULTI_JOIN_SQL, dialect="postgres")))
    results.append(benchmark("Large Multi-Feature SQL (8 KB)", lambda: parse_sql_to_lineage(large_sql, dialect="postgres")))

    # 2. Export & Serialization Engine
    parsed_large = parse_sql_to_lineage(large_sql, dialect="postgres")
    results.append(benchmark("OpenLineage Standard Serialization", lambda: lineage_to_openlineage(parsed_large, large_sql, "postgres")))

    # 3. Full HTTP Request/Response (FastAPI TestClient)
    results.append(benchmark("HTTP API /lineage (Simple)", lambda: client.post("/lineage", json={"sql": SIMPLE_SQL})))
    results.append(benchmark("HTTP API /lineage (2-CTE Pipeline)", lambda: client.post("/lineage", json={"sql": TWO_CTE_SQL, "dialect": "snowflake"})))
    results.append(benchmark("HTTP API /lineage (8 KB Enterprise SQL)", lambda: client.post("/lineage", json={"sql": large_sql, "dialect": "postgres"})))
    results.append(benchmark("HTTP API /health Check", lambda: client.get("/health")))

    # Print Formatted Results Table
    print("┌──────────────────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐")
    print("│ Benchmark Operation                          │ Ops / sec    │ Avg Latency  │ p50 Latency  │ p95 Latency  │ p99 Latency  │")
    print("├──────────────────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤")
    for r in results:
        name = r["name"].ljust(44)
        ops = r["ops_sec"].rjust(12)
        avg = r["avg_ms"].rjust(12)
        p50 = r["p50_ms"].rjust(12)
        p95 = r["p95_ms"].rjust(12)
        p99 = r["p99_ms"].rjust(12)
        print(f"│ {name} │ {ops} │ {avg} │ {p50} │ {p95} │ {p99} │")
    print("└──────────────────────────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘\n")

def test_run_backend_benchmarks():
    """Pytest test case hook to execute backend benchmarks."""
    run_backend_benchmarks()

if __name__ == "__main__":
    run_backend_benchmarks()
