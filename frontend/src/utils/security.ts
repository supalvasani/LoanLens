/**
 * Sanitizes a token (like JWT) by only allowing safe characters: A-Za-z0-9-_=.
 * This helps break the taint analysis chain in static analysis tools like SonarQube
 * by reconstructing the string character-by-character from a strict whitelist.
 */
export function sanitizeToken(token: string | null | undefined): string {
  if (!token) return '';
  
  const allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=.';
  let clean = '';
  for (let i = 0; i < token.length; i++) {
    const char = token.charAt(i);
    if (allowed.indexOf(char) !== -1) {
      clean += char;
    }
  }
  return clean;
}
