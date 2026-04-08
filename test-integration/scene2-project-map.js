/**
 * Scene 2 Test: Project Map
 * Tests that project map returns nodes (files) and edges (call relationships)
 */

import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();
const TENANT_ID = "default";
const PROJECT_ID = "test-integration-project";

async function run() {
  console.log("========================================");
  console.log("Scene 2: Project Map Test");
  console.log("========================================\n");

  // Step 1: Upload test files
  console.log("=== Step 1: Upload test files ===\n");

  const files = [
    {
      file_path: "src/utils/crypto.ts",
      content: `/**
 * Crypto utilities for authentication
 */

/**
 * Hash a password using SHA-256
 * @param password - Plain text password
 * @returns Hashed password
 */
export function hashPassword(password: string): string {
  // Simple hash for demonstration
  return \`hash_\${password}\`;
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
  return \`token_\${Date.now()}\`;
}`,
    },
    {
      file_path: "src/auth.ts",
      content: `import { hashPassword, verifyPassword, generateToken } from "./utils/crypto";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

export class AuthService {
  private users: Map<string, User> = new Map();

  register(username: string, password: string): User {
    const id = \`user_\${Date.now()}\`;
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
}`,
    },
    {
      file_path: "src/api.ts",
      content: `import { createAuthService, AuthService, User } from "./auth";

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
}`,
    },
  ];

  const uploadedFiles = [];

  try {
    const payload = {
      memories: files.map((file) => ({
        content: file.content,
        abstract: `${file.file_path} - code file`,
        overview: `TypeScript code file at ${file.file_path}`,
        type: "code",
        project_id: PROJECT_ID,
        source: "plugin",
        tenant_id: TENANT_ID,
        tags: [],
        metadata: {
          file_path: file.file_path,
          language: "typescript",
        },
      })),
      tenant_id: TENANT_ID,
    };

    const result = await wrapperClient.http.post("/api/v1/memories", payload);

    console.log(`Upload result:`);
    console.log(`  Total: ${result.total}`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Memory IDs: ${JSON.stringify(result.memory_ids)}`);

    if (result.memory_ids && result.memory_ids.length > 0) {
      for (let i = 0; i < files.length; i++) {
        uploadedFiles.push({
          file_path: files[i].file_path,
          memory_id: result.memory_ids[i],
        });
      }
    }
  } catch (error) {
    console.log(`❌ Error uploading files:`, error.message);
  }

  console.log(`\n✅ Successfully uploaded ${uploadedFiles.length} files\n`);

  // Step 2: Create call relationships
  console.log("=== Step 2: Create call relationships ===\n");

  // Find memory IDs
  const cryptoMem = uploadedFiles.find(
    (f) => f.file_path === "src/utils/crypto.ts",
  );
  const authMem = uploadedFiles.find((f) => f.file_path === "src/auth.ts");
  const apiMem = uploadedFiles.find((f) => f.file_path === "src/api.ts");

  if (!cryptoMem || !authMem || !apiMem) {
    console.log("❌ Missing memory IDs for relationships");
    process.exit(1);
  }

  console.log("Memory IDs:");
  console.log(`  crypto.ts: ${cryptoMem.memory_id}`);
  console.log(`  auth.ts: ${authMem.memory_id}`);
  console.log(`  api.ts: ${apiMem.memory_id}`);

  // auth.ts imports from crypto.ts (lines 1, 14, 22, 37)
  const authToCryptoCalls = [
    {
      caller_memory_id: authMem.memory_id,
      callee_memory_id: cryptoMem.memory_id,
      line: 1,
      column: 9,
      file_path: "src/auth.ts",
      relationship_type: "import",
    },
    {
      caller_memory_id: authMem.memory_id,
      callee_memory_id: cryptoMem.memory_id,
      line: 14,
      column: 21,
      file_path: "src/auth.ts",
      relationship_type: "call",
    },
    {
      caller_memory_id: authMem.memory_id,
      callee_memory_id: cryptoMem.memory_id,
      line: 22,
      column: 9,
      file_path: "src/auth.ts",
      relationship_type: "call",
    },
    {
      caller_memory_id: authMem.memory_id,
      callee_memory_id: cryptoMem.memory_id,
      line: 37,
      column: 16,
      file_path: "src/auth.ts",
      relationship_type: "call",
    },
  ];

  // api.ts imports from auth.ts (line 1)
  const apiToAuthCalls = [
    {
      caller_memory_id: apiMem.memory_id,
      callee_memory_id: authMem.memory_id,
      line: 1,
      column: 30,
      file_path: "src/api.ts",
      relationship_type: "import",
    },
    {
      caller_memory_id: apiMem.memory_id,
      callee_memory_id: authMem.memory_id,
      line: 7,
      column: 30,
      file_path: "src/api.ts",
      relationship_type: "call",
    },
    {
      caller_memory_id: apiMem.memory_id,
      callee_memory_id: authMem.memory_id,
      line: 20,
      column: 30,
      file_path: "src/api.ts",
      relationship_type: "call",
    },
    {
      caller_memory_id: apiMem.memory_id,
      callee_memory_id: authMem.memory_id,
      line: 27,
      column: 32,
      file_path: "src/api.ts",
      relationship_type: "call",
    },
  ];

  const allCalls = [...authToCryptoCalls, ...apiToAuthCalls];

  try {
    const result = await wrapperClient.http.post("/api/v1/calls/batch", {
      calls: allCalls,
      tenant_id: TENANT_ID,
    });

    console.log("\nBatch upload result:");
    console.log(`  Status: ${result.status}`);
    console.log(`  Created: ${result.created}`);
    console.log(`  Errors: ${result.errors?.length || 0}`);
    if (result.errors?.length > 0) {
      console.log("  Error details:", result.errors);
    }
  } catch (error) {
    console.log(`❌ Error creating call relationships:`, error.message);
  }

  // Step 3: Query project map
  console.log("\n=== Step 3: Query project map ===\n");

  // Try different project ID formats
  const projectIdsToTry = [
    PROJECT_ID,
    "test",
    "default",
    "global",
    `${TENANT_ID}/${PROJECT_ID}`,
  ];

  let mapResult = null;

  for (const pid of projectIdsToTry) {
    console.log(`Trying project ID: ${pid}`);
    try {
      const result = await wrapperClient.http.get(
        `/api/v1/projects/${encodeURIComponent(pid)}/map`,
      );
      console.log(`  Status: ${result.status}`);

      if (
        result.status === "success" &&
        (result.nodes?.length > 0 || result.edges?.length > 0)
      ) {
        console.log("  ✅ Found data!");
        mapResult = result;
        break;
      } else if (result.status === "success") {
        console.log("  ⚠️ Response success but no data");
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.statusCode || error.message}`);
    }
  }

  // Step 4: Display results
  console.log("\n========================================");
  console.log("Test Results");
  console.log("========================================\n");

  if (mapResult) {
    console.log("✅ PASS: Project map returned data");
    console.log(`\nStatistics:`);
    console.log(`  Nodes: ${mapResult.nodes?.length || 0}`);
    console.log(`  Edges: ${mapResult.edges?.length || 0}`);

    if (mapResult.statistics) {
      console.log(`  Files: ${mapResult.statistics.files || "N/A"}`);
      console.log(`  Functions: ${mapResult.statistics.functions || "N/A"}`);
      console.log(`  Calls: ${mapResult.statistics.calls || "N/A"}`);
    }

    console.log("\nNodes (files):");
    if (mapResult.nodes) {
      for (const node of mapResult.nodes) {
        console.log(
          `  - ${node.metadata?.file_path || node.id} (type: ${node.type || "unknown"})`,
        );
      }
    }

    console.log("\nEdges (relationships):");
    if (mapResult.edges) {
      for (const edge of mapResult.edges) {
        console.log(
          `  - ${edge.source} -> ${edge.target} (${edge.relationship_type || "unknown"})`,
        );
      }
    }
  } else {
    console.log("❌ FAIL: Project map returned empty data");
    console.log("\nTried project IDs:", projectIdsToTry);
  }

  // Step 5: Also try /stats endpoint
  console.log("\n=== Additional: Try /stats endpoint ===\n");

  for (const pid of projectIdsToTry.slice(0, 3)) {
    console.log(`Trying stats for: ${pid}`);
    try {
      const result = await wrapperClient.http.get(
        `/api/v1/projects/${encodeURIComponent(pid)}/stats`,
      );
      console.log(`  Status: ${result.status}`);
      if (result.status === "success") {
        console.log(
          "  Data:",
          JSON.stringify(result.data || result, null, 2).slice(0, 500),
        );
      }
    } catch (error) {
      console.log(`  Error: ${error.statusCode || error.message}`);
    }
  }
}

run().catch(console.error);
