"""Format SQLGlot and API parse errors for structured client responses."""

import re
from typing import Any, Dict, List, Optional

import sqlglot.errors

_CONTEXT_RADIUS = 2


def format_parse_error(
    error: sqlglot.errors.ParseError,
    sql: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a JSON-serializable error payload from a SQLGlot ParseError."""
    items: List[Dict[str, Any]] = []

    for err in error.errors or []:
        raw = err.get("description") or str(error)
        highlight = err.get("highlight")
        line = err.get("line")
        column = err.get("col")
        items.append(
            {
                "message": _humanize_message(raw, highlight=highlight),
                "technical_message": _strip_ansi(raw),
                "line": line,
                "column": column,
                "highlight": highlight,
                "snippet": _build_snippet(err),
                "context_lines": _context_lines(sql, line) if sql and line else [],
            }
        )

    if not items:
        raw = str(error)
        items.append(
            {
                "message": _humanize_message(raw),
                "technical_message": _strip_ansi(raw),
                "line": None,
                "column": None,
                "highlight": None,
                "snippet": None,
                "context_lines": [],
            }
        )

    primary = items[0]
    return {
        "error": "parse_error",
        "message": primary["message"],
        "errors": items,
        "guidance": _generic_guidance(primary),
    }


def _humanize_message(text: str, highlight: Optional[str] = None) -> str:
    """Turn SQLGlot internal messages into plain language without query-specific rules."""
    text = _strip_ansi(text).strip()

    text = re.sub(
        r"<class 'sqlglot\.expressions\.[^']*\.(\w+)'>",
        lambda m: _expression_label(m.group(1)),
        text,
    )
    text = re.sub(r"<class '[^']+'>", "expression", text)
    text = re.sub(r"<Token[^>]+>", "…", text)

    if re.search(r"Required keyword:\s*'this'\s+missing", text, re.I):
        near = highlight or _last_expression_label(text) or "this point"
        return f"Invalid or incomplete syntax before {near}"

    if re.search(r"No expression was parsed from", text, re.I):
        return "Unexpected empty expression — often caused by a stray keyword or missing value nearby"

    if len(text) > 280:
        text = text[:277] + "…"

    return text


def _expression_label(name: str) -> str:
    """Map sqlglot expression class suffix to a readable label."""
    labels = {
        "And": "AND",
        "Or": "OR",
        "Select": "SELECT",
        "Where": "WHERE",
        "Having": "HAVING",
        "Qualify": "QUALIFY",
        "Group": "GROUP BY",
        "Order": "ORDER BY",
    }
    return labels.get(name, name)


def _last_expression_label(text: str) -> Optional[str]:
    match = re.search(r"for\s+(\w+)\s*$", text)
    if match:
        return _expression_label(match.group(1))
    return None


def _build_snippet(err: Dict[str, Any]) -> Optional[str]:
    start = (err.get("start_context") or "").strip()
    highlight = (err.get("highlight") or "").strip()
    end = (err.get("end_context") or "").strip()
    if not start and not highlight and not end:
        return None
    return f"{start}{highlight}{end}".strip()


def _context_lines(sql: str, line_num: int, radius: int = _CONTEXT_RADIUS) -> List[Dict[str, Any]]:
    lines = sql.splitlines()
    if line_num < 1 or line_num > len(lines):
        return []

    start = max(0, line_num - 1 - radius)
    end = min(len(lines), line_num + radius)
    return [
        {
            "line": i + 1,
            "text": lines[i],
            "is_error_line": i + 1 == line_num,
        }
        for i in range(start, end)
    ]


def _generic_guidance(primary: Dict[str, Any]) -> str:
    if primary.get("line") is not None:
        return (
            "The line and column point to where the parser stopped, not always where the mistake was. "
            "Use the context below and check the lines above for typos or misplaced keywords."
        )
    return "Review the SQL near the highlighted snippet for syntax issues."


def _strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)
