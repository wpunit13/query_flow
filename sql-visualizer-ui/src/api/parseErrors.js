/**
 * Structured parse errors from POST /api/parse-sql.
 */
export class ParseSqlError extends Error {
  constructor(detail) {
    const message = detail?.message || 'Failed to parse SQL';
    super(message);
    this.name = 'ParseSqlError';
    this.error = detail?.error || 'parse_error';
    this.errors = detail?.errors || [{ message, line: null, column: null }];
    this.guidance = detail?.guidance;
  }

  static fromResponse(detail) {
    if (detail && typeof detail === 'object' && detail.error === 'parse_error') {
      return new ParseSqlError(detail);
    }
    return null;
  }
}
