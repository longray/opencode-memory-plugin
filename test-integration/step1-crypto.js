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

console.log("=== Step 1: Analyze crypto.ts ===");
const analysisResult = await codeAnalyzer.analyze(
  "src/utils/crypto.ts",
  cryptoCode,
);
console.log("Analysis result:");
console.log(
  "- Functions:",
  analysisResult.functions.map((f) => f.name),
);
console.log("- Calls:", analysisResult.calls);
console.log("- Language:", analysisResult.language);

console.log("\n=== Step 2: Upload crypto.ts to backend ===");
const uploadResult = await wrapperClient.uploadMemories([
  {
    content: cryptoCode,
    abstract: "Crypto utilities: hashPassword, verifyPassword, generateToken",
    overview: "Provides password hashing, verification, and token generation",
    type: "code",
    metadata: {
      file_path: "src/utils/crypto.ts",
      code_analysis: analysisResult,
    },
  },
]);

console.log("Upload result:");
console.log("- Total:", uploadResult.total);
console.log("- Success:", uploadResult.success);
console.log("- Memory IDs:", uploadResult.memory_ids);

if (uploadResult.memory_ids && uploadResult.memory_ids.length > 0) {
  console.log("\n✅ crypto.ts uploaded successfully!");
  console.log("Memory ID:", uploadResult.memory_ids[0]);
} else {
  console.log("\n❌ Upload failed!");
}
