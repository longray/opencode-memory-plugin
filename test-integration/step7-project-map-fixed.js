import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

// Try different project ID formats
const projectIds = ["test", "default", "global", "github.com/test/integration"];

for (const projectId of projectIds) {
  console.log(`\n=== Testing Project ID: ${projectId} ===`);

  try {
    const result = await wrapperClient.http.get(
      `/api/v1/projects/${encodeURIComponent(projectId)}/map`,
    );

    console.log("Status:", result.status);

    if (result.status === "success") {
      console.log("✅ Project found!");
      console.log("Statistics:", result.statistics);
      break;
    }
  } catch (error) {
    console.log("❌ Error:", error.statusCode || error.message);
  }
}

console.log("\n=== Step 12: Get project stats ===");

try {
  const result = await wrapperClient.http.get("/api/v1/projects/test/stats");
  console.log("Stats result:", result);
} catch (error) {
  console.error("Stats error:", error.message);
}
