import { ProjectResolver } from "./opencode-memory-plugin/lib/project-resolver.js";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME || process.env.USERPROFILE;
const configPath = path.join(HOME, ".opencode", "memory", "memory-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("=== Project ID Resolution Test ===\n");
console.log("Config priority:", config.backend.project_resolution.priority);
console.log("Current directory:", process.cwd());

const resolver = new ProjectResolver(config);
const projectId = await resolver.resolve();

console.log("\n✅ Resolved project_id:", projectId);
console.log("\nExpected: @longray/opencode-memory-plugin");
console.log(
  "Match:",
  projectId === "@longray/opencode-memory-plugin" ? "✅ YES" : "❌ NO",
);
