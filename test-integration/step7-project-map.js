import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const projectId = "github.com/test/integration";

console.log("=== Step 11: Get project code map ===");
console.log("Project ID:", projectId);

try {
  const result = await wrapperClient.http.get(
    `/api/v1/projects/${encodeURIComponent(projectId)}/map`,
  );

  console.log("\n=== Code Map Result ===");
  console.log("Status:", result.status);

  if (result.status === "success") {
    console.log("\n📁 File Tree:");
    if (result.file_tree && result.file_tree.length > 0) {
      result.file_tree.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name} (${item.type})`);
        if (item.children) {
          item.children.forEach((child, j) => {
            console.log(`     ${j + 1}. ${child.name} (${child.type})`);
            if (child.complexity) {
              console.log(`        Complexity: ${child.complexity}`);
            }
          });
        }
      });
    } else {
      console.log("  (No file tree data)");
    }

    console.log("\n🔗 Module Dependencies:");
    if (result.module_dependencies && result.module_dependencies.length > 0) {
      result.module_dependencies.forEach((dep, i) => {
        console.log(`  ${i + 1}. ${dep.from} -> ${dep.to} (${dep.type})`);
      });
    } else {
      console.log("  (No dependencies data)");
    }

    console.log("\n🔥 Hot Files:");
    if (result.hot_files && result.hot_files.length > 0) {
      result.hot_files.forEach((file, i) => {
        console.log(`  ${i + 1}. ${file}`);
      });
    } else {
      console.log("  (No hot files)");
    }

    console.log("\n📊 Statistics:");
    if (result.statistics) {
      console.log(`  Total Files: ${result.statistics.total_files}`);
      console.log(`  Total Functions: ${result.statistics.total_functions}`);
      console.log(`  Total Classes: ${result.statistics.total_classes}`);
      console.log(`  Avg Complexity: ${result.statistics.avg_complexity}`);
      console.log(`  Max Complexity: ${result.statistics.max_complexity}`);
    }

    console.log("\n✅ Project map retrieved successfully!");
  } else {
    console.log("\n⚠️ Unexpected status:", result.status);
  }
} catch (error) {
  console.error("\n❌ Failed to get project map:", error.message);
  console.error("Error details:", error);
}
