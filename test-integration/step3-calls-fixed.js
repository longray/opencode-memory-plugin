import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const cryptoMemoryId = "memory:ihvclhn43qeqkg3f3twt";
const authMemoryId = "memory:rdm1dtmxs23ca2f5vqv6";

console.log("=== Step 5: Upload call relationships (Fixed) ===");
console.log("Using relationship_type: reference");

const calls = [
  {
    caller_memory_id: authMemoryId,
    callee_memory_id: cryptoMemoryId,
    line: 6,
    column: 25,
    file_path: "src/auth.ts",
    relationship_type: "reference",
  },
  {
    caller_memory_id: authMemoryId,
    callee_memory_id: cryptoMemoryId,
    line: 12,
    column: 16,
    file_path: "src/auth.ts",
    relationship_type: "reference",
  },
  {
    caller_memory_id: authMemoryId,
    callee_memory_id: cryptoMemoryId,
    line: 21,
    column: 20,
    file_path: "src/auth.ts",
    relationship_type: "reference",
  },
];

try {
  const result = await wrapperClient.http.post("/api/v1/calls/batch", {
    calls: calls,
    tenant_id: "default",
  });

  console.log("\n=== Upload Result ===");
  console.log("Status:", result.status);
  console.log("Created:", result.created);
  console.log("Errors:", result.errors);

  if (result.created === 3) {
    console.log("\n✅ All call relationships uploaded successfully!");
  } else {
    console.log("\n⚠️ Some calls failed:", result.errors);
  }
} catch (error) {
  console.error("\n❌ Failed to upload calls:", error.message);
}
