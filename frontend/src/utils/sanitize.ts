/**
 * Sanitizes JWT token string to satisfy security scanners and prevent potential XSS/tainted data injection.
 * Standard JWT consists of base64url characters separated by dots.
 */
export function sanitizeToken(token: string): string {
  if (!token) return '';
  // Check if it matches the standard JWT pattern: three parts separated by dots, containing only safe characters
  if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=/+#?&]+$/.test(token)) {
    return token;
  }
  // If it doesn't match perfectly, strip out any potential script injection characters
  return token.replace(/[^A-Za-z0-9-_=.]/g, '');
}
