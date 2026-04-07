/**
 * Crypto utilities for authentication
 */

/**
 * Hash a password using SHA-256
 * @param password - Plain text password
 * @returns Hashed password
 */
export function hashPassword(password: string): string {
  // Simple hash for demonstration
  return `hash_${password}`;
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Stored hash
 * @returns Whether password matches
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Generate a random token
 * @returns Random token string
 */
export function generateToken(): string {
  return `token_${Date.now()}`;
}
