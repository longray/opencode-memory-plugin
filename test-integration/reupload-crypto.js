import { codeAnalyzer } from "../opencode-memory-plugin/lib/code-analyzer.js";
import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const cryptoCode = `
export function hashPassword(password) {
  return \`hash_\${password}\`;
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function generateToken() {
  return \`token_\${Date.now()}\`;
}
`;

console.log("=== Re-upload crypto.ts ===");

const analysisResult = await codeAnalyzer.analyze(
  "src/utils/crypto.ts",
  cryptoCode,
);
console.log(
  "Analyzed:",
  analysisResult.functions.map((f) => f.name),
);

const uploadResult = await wrapperClient.uploadMemories([
  {
    content: cryptoCode,
    abstract: "Crypto utilities: hashPassword, verifyPassword, generateToken",
    overview: "Provides password hashing, verification, and token generation",
    type: "code",
    project_id: "test-project",
    metadata: {
      file_path: "src/utils/crypto.ts",
      code_analysis: analysisResult,
    },
  },
]);

console.log("Upload result:", uploadResult);

if (uploadResult.memory_ids?.[0]) {
  const memoryId = uploadResult.memory_ids[0];
  console.log("\nMemory ID:", memoryId);

  // Wait and verify
  console.log("Waiting 2 seconds before verification...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\nVerifying upload...");
  try {
    const verify = await wrapperClient.http.get(`/api/v1/memories/${memoryId}`);
    console.log("✅ Memory exists:", verify.memory?.id);
    console.log("Type:", verify.memory?.type);
  } catch (e) {
    console.log("❌ Memory not found:", e.message);
  }
}
