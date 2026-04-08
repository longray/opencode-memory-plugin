import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const authMemoryId = "memory:rdm1dtmxs23ca2f5vqv6";
const apiMemoryId = "memory:kypsd1yi6eroed7xy0k8";

console.log("=== Step 10: Upload api.ts call relationships ===");
console.log("auth.ts:", authMemoryId);
console.log("api.ts:", apiMemoryId);

const calls = [
  {
    caller_memory_id: apiMemoryId,
    callee_memory_id: authMemoryId,
    line: 8,
    column: 27,
    file_path: "src/api.ts",
  },
  {
    caller_memory_id: apiMemoryId,
    callee_memory_id: authMemoryId,
    line: 20,
    column: 12,
    file_path: "src/api.ts",
  },
  {
    caller_memory_id: apiMemoryId,
    callee_memory_id: authMemoryId,
    line: 24,
    column: 12,
    file_path: "src/api.ts",
  },
];

console.log("\nCall relationships to upload:");
calls.forEach((call, i) => {
  console.log(`${i + 1}. api -> auth (line ${call.line})`);
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
    console.log("\n✅ All api call relationships uploaded successfully!");
  } else {
    console.log("\n⚠️ Some calls failed:", result.errors);
  }
} catch (error) {
  console.error("\n❌ Failed to upload calls:", error.message);
}
