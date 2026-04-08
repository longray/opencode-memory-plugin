import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const client = new WrapperClient();

(async () => {
  console.log("=== Final Scene 2 Report ===\n");

  console.log("Project Map Data:");
  const mapResp = await client.http.get(
    "/api/v1/projects/" +
      encodeURIComponent("test-integration-project") +
      "/map",
  );

  console.log(`Status: ${mapResp.status}`);
  console.log(`Project ID: ${mapResp.project_id}`);
  console.log(`\nFile Tree (nodes):`);
  console.log(JSON.stringify(mapResp.file_tree, null, 2));
  console.log(`\nModule Dependencies (edges):`);
  console.log(JSON.stringify(mapResp.module_dependencies, null, 2));
  console.log(`\nStatistics:`);
  console.log(JSON.stringify(mapResp.statistics, null, 2));
  console.log(`\nHot Files:`);
  console.log(mapResp.hot_files);

  // Check calls endpoint
  console.log("\n=== Check calls for project ===");
  try {
    const callsResp = await client.http.get(
      "/api/v1/calls?project_id=test-integration-project&limit=20",
    );
    console.log("Calls:", JSON.stringify(callsResp, null, 2));
  } catch (e) {
    console.log("Calls error:", e.statusCode, e.message);
  }
})();
