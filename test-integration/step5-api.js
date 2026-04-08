import { codeAnalyzer } from "../opencode-memory-plugin/lib/code-analyzer.js";
import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const apiCode = `
import { createAuthService, AuthService, User } from './auth';

export class ApiService {
  private authService: AuthService;

  constructor() {
    this.authService = createAuthService();
  }

  async fetchUser(userId: string): Promise<User | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, 100);
    });
  }

  async createUser(username: string, password: string): Promise<User> {
    return this.authService.register(username, password);
  }

  async authenticateUser(username: string, password: string): Promise<{ user: User; token: string } | null> {
    return this.authService.login(username, password);
  }
}

export function createApiService(): ApiService {
  return new ApiService();
}
`;

console.log("=== Step 8: Analyze api.ts ===");
const analysisResult = await codeAnalyzer.analyze("src/api.ts", apiCode);
console.log("Analysis result:");
console.log(
  "- Functions:",
  analysisResult.functions.map((f) => f.name),
);
console.log(
  "- Calls:",
  analysisResult.calls.map((c) => ({
    target: c.target,
    line: c.line,
  })),
);

console.log("\n=== Step 9: Upload api.ts to backend ===");
const uploadResult = await wrapperClient.uploadMemories([
  {
    content: apiCode,
    abstract: "API service: createUser, authenticateUser, fetchUser",
    overview: "Provides user management API with auth integration",
    type: "code",
    metadata: {
      file_path: "src/api.ts",
      code_analysis: analysisResult,
    },
  },
]);

console.log("Upload result:");
console.log("- Total:", uploadResult.total);
console.log("- Success:", uploadResult.success);
console.log("- Memory ID:", uploadResult.memory_ids?.[0]);

if (uploadResult.memory_ids?.[0]) {
  console.log("\n✅ api.ts uploaded successfully!");
  console.log("Memory ID:", uploadResult.memory_ids[0]);
} else {
  console.log("\n❌ Upload failed!");
}
