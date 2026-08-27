# 🔍 SQL Lineage Studio (QueryFlow)

Untangle massive, complex SQL queries in seconds. SQL Lineage Studio is an interactive, local-first visualization tool that converts nested CTEs and subqueries into a clean, navigable Data Directed Acyclic Graph (DAG). 

Built for data engineers and analysts who need to debug 1,000+ line queries without losing their minds.

## ✨ Features

* **Interactive DAG Layout:** Automatically parses SQL and renders a beautiful, top-to-bottom directional graph using `dagre` and React Flow.
* **Join Condition Extraction:** Join nodes don't just show connections; click them to reveal the exact `ON` or `USING` conditions joining your tables.
* **Lineage Tracing:** Click any node to instantly highlight its exact upstream sources and downstream targets while dimming unrelated tables.
* **Upstream Decluttering:** Use the "Hide" (eye icon) button on any node to collapse all of its upstream dependencies, allowing you to focus on one branch of logic at a time.
* **Smart Search:** Instantly find tables or specific columns across massive queries. Press `Enter` to dynamically pan and zoom the camera to cycle through matches.
* **Interactive Minimap:** Navigate huge diagrams seamlessly with a draggable, zoomable minimap.
* **Reset Canvas:** A one-click global reset to un-hide nodes and recenter the graph.

## 🛠️ Tech Stack

**Frontend:**
* React 18 + Vite
* [React Flow](https://reactflow.dev/) (Canvas & Node Interactions)
* [Dagre](https://github.com/dagrejs/dagre) (Auto-layout algorithm)

**Backend:**
* Python 3.10+
* [FastAPI](https://fastapi.tiangolo.com/) (High-performance API)
* [SQLGlot](https://github.com/tobymao/sqlglot) (No-dependency SQL parser & AST generator)

---

## 🚀 Getting Started

This project is split into a Python backend API and a React frontend. You will need to run both concurrently.

### Prerequisites
* Node.js (v16 or higher)
* Python (3.8 or higher)

### 1. Start the Backend (FastAPI)

Open your terminal and navigate to the root directory of the repository.

```bash
# 1. Create a virtual environment
python -m venv venv

# 2. Activate the virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the FastAPI server
uvicorn main:app --reload