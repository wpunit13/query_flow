import re
from typing import List, Tuple


def preprocess_sql(sql: str) -> Tuple[str, List[str]]:
    """Normalize SQL patterns sqlglot cannot parse; return transformed SQL and warnings."""
    warnings: List[str] = []

    def lateral_replacer(match: re.Match) -> str:
        join_side = match.group(1) or "LEFT"
        warnings.append(
            f"LATERAL join normalized to {join_side} JOIN (subquery) at position {match.start()}"
        )
        return f"{join_side} JOIN ("

    transformed = re.sub(
        r"\b(LEFT|RIGHT|INNER)?\s+LATERAL\s*\(",
        lateral_replacer,
        sql,
        flags=re.IGNORECASE,
    )
    return transformed, warnings
