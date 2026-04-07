import { hashPassword, verifyPassword, generateToken } from "./utils/crypto";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

export class AuthService {
  private users: Map<string, User> = new Map();

  register(username: string, password: string): User {
    const id = `user_${Date.now()}`;
    const passwordHash = hashPassword(password);
    const user: User = { id, username, passwordHash };
    this.users.set(id, user);
    return user;
  }

  validateUser(username: string, password: string): User | null {
    for (const user of this.users.values()) {
      if (user.username === username) {
        if (verifyPassword(password, user.passwordHash)) {
          return user;
        }
      }
    }
    return null;
  }

  login(
    username: string,
    password: string,
  ): { user: User; token: string } | null {
    const user = this.validateUser(username, password);
    if (user) {
      const token = generateToken();
      return { user, token };
    }
    return null;
  }
}

export function createAuthService(): AuthService {
  return new AuthService();
}
