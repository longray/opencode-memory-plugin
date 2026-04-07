import { codeAnalyzer } from "../opencode-memory-plugin/lib/code-analyzer.js";
import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const authCode = `
import { hashPassword, verifyPassword, generateToken } from './utils/crypto';

export class AuthService {
  register(username, password) {
    const passwordHash = hashPassword(password);
    return { id: 'user_1', username, passwordHash };
  }

  validateUser(username, password) {
    const user = this.findUser(username);
    if (user && verifyPassword(password, user.passwordHash)) {
      return user;
    }
    return null;
  }

  login(username, password) {
    const user = this.validateUser(username, password);
    if (user) {
      const token = generateToken();
      return { user, token };
    }
    return null;
  }
}

export function createAuthService() {
  return new AuthService();
}
`;

console.log("=== Step 3: Analyze auth.ts ===");
const analysisResult = await codeAnalyzer.analyze("src/auth.ts", authCode);
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
    column: c.column,
  })),
);

console.log("\n=== Step 4: Upload auth.ts to backend ===");
const uploadResult = await wrapperClient.uploadMemories([
  {
    content: authCode,
    abstract: "Auth service: register, validateUser, login",
    overview:
      "Provides user registration, validation, and login with token generation",
    type: "code",
    metadata: {
      file_path: "src/auth.ts",
      code_analysis: analysisResult,
    },
  },
]);

console.log("Upload result:");
console.log("- Total:", uploadResult.total);
console.log("- Success:", uploadResult.success);
console.log("- Memory IDs:", uploadResult.memory_ids);

if (uploadResult.memory_ids && uploadResult.memory_ids.length > 0) {
  console.log("\n✅ auth.ts uploaded successfully!");
  console.log("Memory ID:", uploadResult.memory_ids[0]);

  // Save memory IDs for next step
  console.log("\n=== Memory IDs for Step 3 ===");
  console.log("crypto.ts: memory:ihvclhn43qeqkg3f3twt");
  console.log("auth.ts:", uploadResult.memory_ids[0]);
} else {
  console.log("\n❌ Upload failed!");
}
