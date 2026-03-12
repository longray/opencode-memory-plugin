#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";

const MEMORY_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".opencode",
  "memory",
);
const BACKEND_URL = "http://localhost:17999";
const TENANT_ID = process.env.USERNAME || "default";
const BATCH_SIZE = 10;

function generateSourceId(content, type, tags, tenantId, projectId) {
  const data = `${content}|${type}|${tags.join(",")}|${tenantId}|${projectId}`;
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .substring(0, 16);
}

async function uploadBatch(memories) {
  const response = await fetch(`${BACKEND_URL}/api/v1/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memories, tenant_id: TENANT_ID }),
  });

  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
  const result = await response.json();
  return { success: result.uploaded || memories.length, failed: 0 };
}

function parseMemoryFile(filePath, fileName) {
  const content = fs.readFileSync(filePath, "utf-8");
  const entries = [];
  const entryMatches = content.split(/\n## /).slice(1);

  for (const entryContent of entryMatches) {
    const lines = entryContent.split("\n");
    const title = lines[0];
    const typeMatch = title.match(/^(\w+) Entry/);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "general";

    const tagsLine = lines.find((l) => l.startsWith("**Tags**:"));
    const tags = tagsLine
      ? tagsLine
          .replace("**Tags**:", "")
          .trim()
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && t !== "none")
      : [];

    const contentStart = lines.findIndex((l) => l === "") + 1;
    const entryText = lines
      .slice(contentStart)
      .join("\n")
      .replace(/---\s*$/, "")
      .trim();

    if (entryText && entryText.length > 20) {
      entries.push({
        content: entryText,
        type,
        tags,
        project_id: "global",
        source_id: generateSourceId(entryText, type, tags, TENANT_ID, "global"),
        tenant_id: TENANT_ID,
        source: "plugin",
        metadata: { source_file: fileName },
      });
    }
  }
  return entries;
}

async function main() {
  console.log("🔄 Starting memory sync...\n");

  const health = await fetch(`${BACKEND_URL}/health`);
  if (!health.ok) {
    console.error("❌ Backend unavailable");
    process.exit(1);
  }

  const memoryFile = path.join(MEMORY_DIR, "MEMORY.md");
  if (!fs.existsSync(memoryFile)) {
    console.log("✅ No memory files found");
    return;
  }

  console.log("📖 Parsing MEMORY.md...");
  const entries = parseMemoryFile(memoryFile, "MEMORY.md");
  console.log(`📊 Found ${entries.length} entries\n`);

  let totalSuccess = 0,
    totalFailed = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    try {
      const result = await uploadBatch(batch);
      totalSuccess += result.success;
      console.log(
        `✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}: ${result.success} uploaded`,
      );
    } catch (e) {
      totalFailed += batch.length;
      console.error(`❌ Batch failed: ${e.message}`);
    }
  }

  console.log(
    `\n🔄 Sync completed: ${totalSuccess}/${entries.length} successful`,
  );
}

main().catch(console.error);
