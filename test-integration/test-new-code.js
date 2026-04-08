import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const uniqueCode = `
// Test file generated at ${Date.now()}
export function uniqueFunction${Date.now()}() {
  return "unique";
}
`;

console.log("=== Test uploading new code ===");
console.log("Content timestamp:", Date.now());

const uploadResult = await wrapperClient.uploadMemories([
  {
    content: uniqueCode,
    abstract: "Unique test function",
    overview: "Test code for dedup verification",
    type: "code",
    project_id: "test-project",
    metadata: {
      file_path: `src/test_${Date.now()}.ts`,
      code_analysis: {
        language: "typescript",
        functions: [{ name: "uniqueFunction", line: 3 }],
      },
    },
  },
]);

console.log("Upload result:", uploadResult);

if (uploadResult.memory_ids?.[0]) {
  const memoryId = uploadResult.memory_ids[0];
  console.log("\nMemory ID:", memoryId);

  console.log("Waiting 2 seconds...");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\nVerifying...");
  try {
    const verify = await wrapperClient.http.get(`/api/v1/memories/${memoryId}`);
    console.log("✅ SUCCESS! Memory exists");
    console.log("Type:", verify.memory?.type);
    console.log("Project:", verify.memory?.project_id);
  } catch (e) {
    console.log("❌ FAILED:", e.message);
  }
} else if (uploadResult.skipped?.length > 0) {
  console.log("\n⚠️ Upload was skipped (dedup)");
  console.log("Skip reason:", uploadResult.skipped[0].reason);
} else {
  console.log("\n❌ Upload failed");
}
