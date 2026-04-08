import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const cryptoMemoryId = "memory:ihvclhn43qeqkg3f3twt";
const authMemoryId = "memory:rdm1dtmxs23ca2f5vqv6";

console.log("=== Step 5: Upload call relationships ===");
console.log("crypto.ts Memory ID:", cryptoMemoryId);
console.log("auth.ts Memory ID:", authMemoryId);

const calls = [
  {
    caller_memory_id: authMemoryId,
    callee_memory_id: cryptoMemoryId,
    line: 6,
    column: 25,
    file_path: "src/auth.ts",
  },
  {
    caller_memory_id: authMemoryId,
    callee_memory_id: cryptoMemoryId,
    line: 12,
    column: 16,
    file_path: "src/auth.ts",
  },
  {
    caller_memory_id: authMemoryId,
    callee_memory_id: cryptoMemoryId,
    line: 21,
    column: 20,
    file_path: "src/auth.ts",
  },
];

console.log("\nCall relationships to upload:");
calls.forEach((call, i) => {
  console.log(
    `${i + 1}. ${call.caller_memory_id} -> ${call.callee_memory_id} (line ${call.line})`,
  );
});

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
