import { createAuthService, AuthService, User } from "./auth";

export class ApiService {
  private authService: AuthService;

  constructor() {
    this.authService = createAuthService();
  }

  async fetchUser(userId: string): Promise<User | null> {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, 100);
    });
  }

  async createUser(username: string, password: string): Promise<User> {
    return this.authService.register(username, password);
  }

  async authenticateUser(
    username: string,
    password: string,
  ): Promise<{ user: User; token: string } | null> {
    return this.authService.login(username, password);
  }
}

export function createApiService(): ApiService {
  return new ApiService();
}
