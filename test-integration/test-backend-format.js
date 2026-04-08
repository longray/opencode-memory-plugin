import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const timestamp = Date.now();

const payload = {
  memories: [
    {
      type: "code",
      content: `// Test file generated at ${timestamp}
export function uniqueFunction${timestamp}() {
  return 'unique';
}`,
      abstract: "Unique test function",
      overview: "Test code for dedup verification",
      project_id: "test-project",
      metadata: {
        file_path: `src/test_${timestamp}.ts`,
        code_analysis: {
          language: "typescript",
          functions: [{ name: "uniqueFunction", line: 3 }],
        },
      },
    },
  ],
  tenant_id: "default",
};

console.log("=== Test with backend format ===");
console.log("Timestamp:", timestamp);

try {
  const result = await wrapperClient.http.post("/api/v1/memories", payload);

  console.log("Upload response:", result);

  if (result.success === 0 && !result.memory_ids) {
    console.log("❌ Upload failed");
    process.exit(1);
  }

  const memoryId = result.memory_ids?.[0];
  if (!memoryId) {
    console.log("❌ No memory_id returned");
    process.exit(1);
  }

  console.log("✅ Upload success, memory_id:", memoryId);

  console.log("\nWaiting 2 seconds...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n=== Query verification ===");
  const queryResult = await wrapperClient.http.get(
    `/api/v1/memories/${memoryId}?tenant_id=default`,
  );

  console.log("Query response:", queryResult.status);
  if (queryResult.status === "success") {
    console.log("✅ Query success!");
    console.log("Type:", queryResult.memory?.type);
    console.log("Project:", queryResult.memory?.project_id);
  } else {
    console.log("❌ Query failed:", queryResult);
  }
} catch (error) {
  console.error("❌ Error:", error.message);
}
