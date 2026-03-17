import { execSync } from "child_process";

console.log("=== Git Strategy Diagnostic Test ===\n");

// Test 1: Current working directory
const cwd = process.cwd();
console.log("1. Current working directory:");
console.log("   ", cwd);
console.log();

// Test 2: Git remote get-url origin
console.log("2. Testing git remote get-url origin:");
try {
  const result = execSync("git remote get-url origin", {
    cwd,
    encoding: "utf-8",
    timeout: 5000,
  });
  console.log("   ✅ Success:", result.trim());
} catch (error) {
  console.log("   ❌ Failed:", error.message);
}
console.log();

// Test 3: Extract project ID from URL
console.log("3. Testing extractProjectIdFromGitUrl:");
const testUrls = [
  "https://github.com/longray/opencode-memory-plugin.git",
  "git@github.com:longray/opencode-memory-plugin.git",
  "https://github.com/longray/opencode-memory-plugin",
];

function extractProjectIdFromGitUrl(url) {
  if (!url) return null;
  url = url.replace(/\.git$/, "");

  if (url.includes("@") && url.includes(":")) {
    const match = url.match(/@[^:]+:(.+)$/);
    if (match) return "@" + match[1];
  }

  url = url.replace(/^https?:\/\//, "");
  const pathMatch = url.match(/^[^/]+\/(.+)$/);
  if (pathMatch) return "@" + pathMatch[1];

  return null;
}

testUrls.forEach((url) => {
  const projectId = extractProjectIdFromGitUrl(url);
  console.log(`   ${url}`);
  console.log(`   → ${projectId}`);
});
