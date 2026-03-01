/**
 * Removes sensitive data (passwords, connection strings) from error messages
 * before displaying to the user.
 */
export function sanitizeErrorMessage(error: unknown): string {
  let msg = error instanceof Error ? error.message : String(error);
  // Remove postgres:// or postgresql:// URLs (contain passwords)
  msg = msg.replace(/postgres(ql)?:\/\/[^\s]+/gi, '[connection string hidden]');
  // Remove common patterns that might leak credentials
  msg = msg.replace(/password[=:]\S+/gi, 'password=***');
  return msg;
}
