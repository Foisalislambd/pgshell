/**
 * Removes sensitive data (passwords, connection strings) from error messages
 * and translates common PostgreSQL errors into human-friendly messages.
 */
export function sanitizeErrorMessage(error: unknown): string {
  let msg = error instanceof Error ? error.message : String(error);
  // Remove postgres:// or postgresql:// URLs (contain passwords)
  msg = msg.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[connection string hidden]');
  // Remove common patterns that might leak credentials
  msg = msg.replace(/password[=:]\S+/gi, 'password=***');

  // Map common PostgreSQL errors to human-friendly messages
  const friendlyMap: [RegExp, string][] = [
    [/relation\s+"[^"]*"\s+does not exist/i, "This table or view doesn't exist. Check the name and try again."],
    [/syntax error at or near/i, "There's a syntax error in your SQL. Check for typos or missing quotes."],
    [/duplicate key value violates unique constraint/i, "A record with this value already exists. Try a different value."],
    [/violates not-null constraint/i, "This field cannot be empty. Please provide a value."],
    [/violates foreign key constraint/i, "This value doesn't exist in the referenced table. Check your references."],
    [/connection refused/i, "Couldn't connect. Is PostgreSQL running? Check host and port."],
    [/ECONNREFUSED/i, "Couldn't connect. Is PostgreSQL running? Check host and port."],
    [/password authentication failed/i, "Wrong username or password. Please try again."],
    [/database "[^"]*" does not exist/i, "This database doesn't exist. Use 'List all databases' to see available ones."],
    [/already exists/i, "This already exists. Choose a different name."],
    [/permission denied/i, "You don't have permission to perform this action."],
    [/timeout/i, "The operation took too long. Try again or simplify your query."],
    [/column "[^"]*" does not exist/i, "This column doesn't exist. Check the table structure."],
  ];

  for (const [pattern, friendly] of friendlyMap) {
    if (pattern.test(msg)) {
      return friendly;
    }
  }

  return msg;
}
