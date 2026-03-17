import { resolveProjectIdWithDetails } from "./opencode-memory-plugin/lib/project-resolver.js";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME || process.env.USERPROFILE;
const configPath = path.join(HOME, ".opencode", "memory", "memory-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("=== Project ID Resolution Details ===\n");

const details = await resolveProjectIdWithDetails(config);

console.log("Final project_id:", details.project_id);
console.log("Working directory:", details.cwd);
console.log("\nStrategy attempts:");
details.details.forEach((d, i) => {
  console.log(
    `  ${i + 1}. ${d.strategy}: ${d.result || "(failed)"} ${d.used ? "✅ USED" : ""}`,
  );
});
