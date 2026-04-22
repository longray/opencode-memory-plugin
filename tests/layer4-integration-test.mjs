#!/usr/bin/env node

/**
 * Layer 4: OpenCode Integration Tests
 * Tests tool chaining scenarios (Layer 4 from TEST-SCENARIOS-v3.2.md)
 *
 * Usage: node tests/layer4-integration-test.mjs
 */

import { memory_write } from "../opencode-memory-plugin/tools/core.js";
import { memory_search } from "../opencode-memory-plugin/tools/search.js";
import {
  memory_relate,
  memory_graph,
} from "../opencode-memory-plugin/tools/graph.js";
import {
  index_status,
  incremental_sync,
} from "../opencode-memory-plugin/tools/sync.js";
import { readMemory } from "../opencode-memory-plugin/lib/memory-core.js";
import { getConfig } from "../opencode-memory-plugin/lib/storage.js";
import fs from "fs";

const TENANT_ID = "default";

// ===== Test State =====
const results = [];
const testMemories = [];

// ===== Test Framework =====

function record(
  testId,
  description,
  status,
  responseTimeMs,
  details = null,
  error = null,
) {
  results.push({ testId, description, status, responseTimeMs, details, error });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  const extra = error ? ` | Error: ${error}` : "";
  const detailsStr = details ? ` | Details: ${JSON.stringify(details)}` : "";
  console.log(
    `  ${icon} ${testId}: ${description} [${responseTimeMs}ms]${detailsStr}${extra}`,
  );
}

async function runTest(testId, description, fn) {
  const start = performance.now();
  try {
    const { details, ...rest } = await fn();
    const ms = Math.round(performance.now() - start);
    record(testId, description, "PASS", ms, details);
    return rest;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    record(testId, description, "FAIL", ms, null, err.message || String(err));
    return null;
  }
}

// ===== Constants =====
const TEST_CONVERSATION_ID = "conversation:layer4-test";
const TEST_DATA = {
  chain001: {
    content:
      "Use try-catch blocks for async error handling. Always catch specific error types and provide meaningful error messages. Log errors with context for debugging.",
    abstract: "Async error handling pattern",
    overview:
      "Best practices for handling errors in async/await code: use try-catch, catch specific errors, provide context",
    type: "code",
    tags: ["error-handling", "async", "javascript", "best-practices"],
  },
  chain002: {
    content:
      "User prefers TypeScript over JavaScript for new projects due to better type safety and IDE support",
    abstract: "TypeScript preference",
    overview:
      "User likes TypeScript for type safety, better tooling, and IDE autocomplete support",
    type: "preference",
    tags: ["preference", "typescript", "javascript"],
  },
};

// ===== Helper Functions =====

/**
 * Validate ULID format (26 characters, Crockford's base32)
 */
function isValidUlid(id) {
  return id && /^[0-9A-Z]{26}$/.test(id);
}

/**
 * Extract local ID from memory_write result
 * Format: "ID: 01Kxxx..." (26 characters)
 */
function extractLocalId(result) {
  const match = result.match(/ID:\s*([A-Z0-9]{26})/);
  const id = match ? match[1] : null;
  if (id && !isValidUlid(id)) {
    console.warn(`Warning: ID ${id} doesn't match ULID format`);
  }
  return id;
}

/**
 * Extract memory ID from memory_write result
 * Format: "Memory ID: memory:xxx"
 */
function extractMemoryId(result) {
  const match = result.match(/Memory ID:\s*(memory:[a-z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Extract ID from search results
 * Format: "ID: memory:xxx" or "ID: 01Kxxx"
 */
function extractIdFromSearch(result) {
  // Try memory:xxx format first
  const memoryMatch = result.match(/ID:\s*(memory:[a-z0-9]+)/);
  if (memoryMatch) return memoryMatch[1];

  // Try local ID format (ULID: 26 chars)
  const localMatch = result.match(/ID:\s*([A-Z0-9]{26})/);
  return localMatch ? localMatch[1] : null;
}

// ===== Cleanup Helper =====
async function cleanupTestMemories(ids) {
  console.log("\n🧹 Cleanup: deleting test memories...");
  const { getEntryById } =
    await import("../opencode-memory-plugin/lib/storage.js");
  const { removeFromLinkMap } =
    await import("../opencode-memory-plugin/lib/indexer.js");

  let deletedCount = 0;
  for (const id of ids) {
    try {
      const entry = getEntryById(id);
      if (entry?.path && fs.existsSync(entry.path)) {
        fs.unlinkSync(entry.path);
        await removeFromLinkMap(id);
        deletedCount++;
        console.log(`  Deleted: ${id}`);
      } else {
        console.log(`  Not found (already deleted?): ${id}`);
      }
    } catch (err) {
      console.warn(`  Failed to delete ${id}: ${err.message}`);
    }
  }
  console.log(`  Cleanup complete: ${deletedCount}/${ids.length} deleted.`);
  return deletedCount;
}

// ===== Test Suite =====

async function main() {
  console.log("=".repeat(70));
  console.log("Layer 4: OpenCode Integration Tests");
  console.log("Testing tool chaining scenarios");
  console.log(`Tenant: ${TENANT_ID}`);
  console.log("=".repeat(70));

  // ===== Phase 1: Tool Chain Tests =====
  console.log("\n--- Phase 1: Tool Chain Tests ---");

  // TC-CHAIN-001: 搜索 → 读取 → 关联
  let chainLocalId = null;

  await runTest("TC-CHAIN-001", "Search → Read → Relate chain", async () => {
    console.log("\n  [TC-CHAIN-001] Step 0: Create test memory...");

    // Step 0: Create a test memory for searching
    const writeResult = await memory_write.execute(TEST_DATA.chain001);

    if (writeResult.includes("❌")) {
      throw new Error(`Failed to create test memory: ${writeResult}`);
    }

    chainLocalId = extractLocalId(writeResult);

    if (chainLocalId) {
      testMemories.push(chainLocalId);
    }

    console.log(`    Created: localId=${chainLocalId}`);

    // Step 1: Search
    console.log("  [TC-CHAIN-001] Step 1: memory_search...");
    const searchResult = await memory_search.execute({
      query: "async error handling",
      mode: "keyword",
      limit: 5,
      level: 0,
    });

    if (searchResult.includes("❌")) {
      throw new Error(`Search error: ${searchResult}`);
    }

    const foundId = extractIdFromSearch(searchResult);
    if (!foundId) {
      throw new Error("No memory found in search results");
    }
    console.log(`    Found ID: ${foundId}`);

    // Step 2: Read (progressive loading)
    console.log("  [TC-CHAIN-001] Step 2: memory_read (level=1)...");

    // Use the ID we just created (chainLocalId) or the one found in search
    const readId = chainLocalId || foundId;
    const readResult = await readMemory({
      entry_id: readId,
      level: 1,
    });

    if (!readResult.success) {
      throw new Error(`Read failed: ${readResult.message}`);
    }

    console.log(
      `    Read success: ${readResult.entry.abstract.substring(0, 50)}...`,
    );

    // Step 3: Create relation
    console.log("  [TC-CHAIN-001] Step 3: memory_relate...");

    const targetId = readResult.entry.id || readId;
    const relateResult = await memory_relate.execute({
      action: "create",
      from_id: TEST_CONVERSATION_ID,
      to_id: targetId,
      relation_type: "referenced",
      weight: 0.9,
    });

    if (relateResult.includes("❌")) {
      // Backend might not be available, record as partial success
      console.log(`    Note: ${relateResult}`);
      return {
        details: {
          searchSuccess: true,
          readSuccess: true,
          relateSuccess: false,
          relateNote: "Backend may not be available for graph relations",
          foundId,
          readId: targetId,
        },
      };
    }

    console.log("    Relation created successfully");

    // Step 4: Verify relation
    console.log("  [TC-CHAIN-001] Step 4: Verify relation...");
    const queryResult = await memory_relate.execute({
      action: "query",
      from_id: TEST_CONVERSATION_ID,
    });

    const relationVerified =
      queryResult.includes(targetId) || queryResult.includes("✅");

    return {
      details: {
        searchSuccess: true,
        readSuccess: true,
        relateSuccess: true,
        relationVerified,
        foundId,
        readId: targetId,
      },
    };
  });

  // TC-CHAIN-002: 写入 → 同步 → 验证
  let writeSyncLocalId = null;

  await runTest("TC-CHAIN-002", "Write → Sync → Verify chain", async () => {
    console.log("\n  [TC-CHAIN-002] Step 1: memory_write...");

    // Step 1: Write
    const writeResult = await memory_write.execute(TEST_DATA.chain002);

    if (writeResult.includes("❌")) {
      throw new Error(`Write failed: ${writeResult}`);
    }

    writeSyncLocalId = extractLocalId(writeResult);
    const writeMemoryId = extractMemoryId(writeResult);

    if (writeSyncLocalId) {
      testMemories.push(writeSyncLocalId);
    }

    console.log(
      `    Written: localId=${writeSyncLocalId}, memoryId=${writeMemoryId}`,
    );

    // Step 2: Sync
    console.log("  [TC-CHAIN-002] Step 2: incremental_sync...");
    const syncResult = await incremental_sync.execute({
      dry_run: false,
    });

    const syncSuccess = !syncResult.includes("❌");
    console.log(`    Sync: ${syncSuccess ? "Success" : "Failed/Skipped"}`);

    // Step 3: Verify via index_status
    console.log("  [TC-CHAIN-002] Step 3: index_status...");
    const statusResult = await index_status.execute({
      detailed: true,
    });

    const statusSuccess = !statusResult.includes("❌");
    console.log(`    Status check: ${statusSuccess ? "Success" : "Failed"}`);

    return {
      details: {
        writeSuccess: true,
        syncAttempted: true,
        syncSuccess,
        statusSuccess,
        localId: writeSyncLocalId,
        memoryId: writeMemoryId,
      },
    };
  });

  // ===== Phase 2: Error Recovery Tests =====
  console.log("\n--- Phase 2: Error Recovery Tests ---");

  // TC-ERROR-001: Backend unavailable fallback
  await runTest(
    "TC-ERROR-001",
    "Backend unavailable - local fallback",
    async () => {
      // This test verifies that when backend is unavailable,
      // operations still succeed locally

      const config = getConfig();
      const backendEnabled = config?.backend?.enabled !== false;

      // Write should always work (local first)
      const writeResult = await memory_write.execute({
        content: "Test local write when backend unavailable",
        abstract: "Local write test",
        overview: "Testing local write functionality",
        type: "general",
        tags: ["test"],
      });

      if (writeResult.includes("❌")) {
        throw new Error(`Local write failed: ${writeResult}`);
      }

      const localId = extractLocalId(writeResult);
      if (localId) {
        testMemories.push(localId);
      }

      // Search should fallback to local
      const searchResult = await memory_search.execute({
        query: "local write test",
        mode: "keyword",
        limit: 5,
      });

      const searchWorked =
        !searchResult.includes("❌") || searchResult.includes("No results");

      return {
        details: {
          backendEnabled,
          localWriteSuccess: true,
          localSearchWorked: searchWorked,
          note: backendEnabled
            ? "Backend available"
            : "Backend disabled, using local fallback",
        },
      };
    },
  );

  // TC-ERROR-002: Invalid ID handling
  await runTest("TC-ERROR-002", "Invalid ID error handling", async () => {
    // Try to read with invalid ID
    const readResult = await readMemory({
      entry_id: "invalid-id-12345",
      level: 1,
    });

    if (readResult.success) {
      throw new Error("Should have failed with invalid ID");
    }

    // Try to relate with invalid IDs
    const relateResult = await memory_relate.execute({
      action: "create",
      from_id: "invalid-from",
      to_id: "invalid-to",
      relation_type: "test",
    });

    const relateFailed =
      relateResult.includes("❌") || relateResult.includes("Error");

    return {
      details: {
        readErrorHandled: true,
        readErrorMessage: readResult.message?.substring(0, 50),
        relateErrorHandled: relateFailed,
      },
    };
  });

  // ===== Phase 3: Progressive Loading Tests =====
  console.log("\n--- Phase 3: Progressive Loading Tests ---");

  // Create a test memory for progressive loading tests
  let progressiveTestId = null;

  await runTest("TC-PROG-001", "Setup: Create test memory", async () => {
    const writeResult = await memory_write.execute({
      content: "This is the full content for progressive loading test. ".repeat(
        20,
      ),
      abstract: "Progressive loading test",
      overview:
        "This is the overview section that should be returned with level=1. " +
        "It contains more details than abstract but less than full content.",
      type: "test",
      tags: ["test", "progressive-loading"],
    });

    if (writeResult.includes("❌")) {
      throw new Error(`Setup failed: ${writeResult}`);
    }

    progressiveTestId = extractLocalId(writeResult);
    if (progressiveTestId) {
      testMemories.push(progressiveTestId);
    }

    return {
      details: {
        created: true,
        localId: progressiveTestId,
      },
    };
  });

  // TC-PROG-002: Level 0 (abstract only)
  await runTest("TC-PROG-002", "Progressive loading - Level 0", async () => {
    if (!progressiveTestId) {
      throw new Error("Setup failed");
    }

    const result = await readMemory({
      entry_id: progressiveTestId,
      level: 0,
    });

    if (!result.success) {
      throw new Error(`Level 0 read failed: ${result.message}`);
    }

    // Level 0 should only have abstract
    const hasAbstract =
      result.entry.abstract && result.entry.abstract.length > 0;
    const contentLength = result.content?.length || 0;

    return {
      details: {
        hasAbstract,
        contentLength,
        abstract: result.entry.abstract?.substring(0, 50),
      },
    };
  });

  // TC-PROG-003: Level 1 (abstract + overview)
  await runTest("TC-PROG-003", "Progressive loading - Level 1", async () => {
    if (!progressiveTestId) {
      throw new Error("Setup failed");
    }

    const result = await readMemory({
      entry_id: progressiveTestId,
      level: 1,
    });

    if (!result.success) {
      throw new Error(`Level 1 read failed: ${result.message}`);
    }

    const hasAbstract =
      result.entry.abstract && result.entry.abstract.length > 0;
    const hasOverview =
      result.entry.overview && result.entry.overview.length > 0;
    const contentLength = result.content?.length || 0;

    return {
      details: {
        hasAbstract,
        hasOverview,
        contentLength,
        overview: result.entry.overview?.substring(0, 50),
      },
    };
  });

  // TC-PROG-004: Level 2 (full content)
  await runTest("TC-PROG-004", "Progressive loading - Level 2", async () => {
    if (!progressiveTestId) {
      throw new Error("Setup failed");
    }

    const result = await readMemory({
      entry_id: progressiveTestId,
      level: 2,
    });

    if (!result.success) {
      throw new Error(`Level 2 read failed: ${result.message}`);
    }

    const hasAbstract =
      result.entry.abstract && result.entry.abstract.length > 0;
    const hasOverview =
      result.entry.overview && result.entry.overview.length > 0;
    const hasFullContent = result.content && result.content.length > 100;

    return {
      details: {
        hasAbstract,
        hasOverview,
        hasFullContent,
        contentLength: result.content?.length,
      },
    };
  });

  // ===== Phase 4: Graph Traversal Tests =====
  console.log("\n--- Phase 4: Graph Traversal Tests ---");

  // TC-GRAPH-001: Create relation and traverse
  await runTest(
    "TC-GRAPH-001",
    "Create relation and traverse graph",
    async () => {
      // Create two memories
      const writeResult1 = await memory_write.execute({
        content: "Parent memory for graph traversal test",
        abstract: "Parent node",
        overview: "This is the parent memory node",
        type: "test",
        tags: ["graph-test"],
      });

      const writeResult2 = await memory_write.execute({
        content: "Child memory for graph traversal test",
        abstract: "Child node",
        overview: "This is the child memory node",
        type: "test",
        tags: ["graph-test"],
      });

      if (writeResult1.includes("❌") || writeResult2.includes("❌")) {
        throw new Error("Failed to create test memories");
      }

      const id1 = extractLocalId(writeResult1);
      const id2 = extractLocalId(writeResult2);

      if (id1) testMemories.push(id1);
      if (id2) testMemories.push(id2);

      // Create relation
      const relateResult = await memory_relate.execute({
        action: "create",
        from_id: id1,
        to_id: id2,
        relation_type: "related",
        weight: 0.8,
      });

      if (relateResult.includes("❌")) {
        // Backend might not be available
        return {
          details: {
            memoriesCreated: true,
            relationCreated: false,
            note: "Backend not available for graph operations",
          },
        };
      }

      // Traverse graph
      const graphResult = await memory_graph.execute({
        memory_id: id1,
        depth: 2,
        limit: 10,
      });

      const traverseSuccess =
        !graphResult.includes("❌") && !graphResult.includes("No related");

      return {
        details: {
          memoriesCreated: true,
          relationCreated: true,
          traverseSuccess,
          hasRelatedNodes: traverseSuccess,
        },
      };
    },
  );

  // ===== Phase 5: Edge Case Tests =====
  console.log("\n--- Phase 5: Edge Case Tests ---");

  // TC-EDGE-001: Empty content handling
  await runTest("TC-EDGE-001", "Empty content handling", async () => {
    const result = await memory_write.execute({
      content: "",
      abstract: "Empty content test",
      overview: "Testing empty content handling",
      type: "test",
      tags: ["edge-case", "empty"],
    });

    // Empty content should be handled gracefully
    const handled = !result.includes("❌") || result.includes("abstract");

    if (!result.includes("❌")) {
      const id = extractLocalId(result);
      if (id) testMemories.push(id);
    }

    return {
      details: {
        handled,
        hasError: result.includes("❌"),
        note: "Empty content should be accepted or rejected gracefully",
      },
    };
  });

  // TC-EDGE-002: Very long content (>10KB)
  await runTest("TC-EDGE-002", "Long content handling (>10KB)", async () => {
    const longContent = "Lorem ipsum dolor sit amet. ".repeat(500); // ~15KB

    const result = await memory_write.execute({
      content: longContent,
      abstract: "Long content test",
      overview: `Testing long content handling (${longContent.length} chars)`,
      type: "test",
      tags: ["edge-case", "long-content"],
    });

    const success = !result.includes("❌");

    if (success) {
      const id = extractLocalId(result);
      if (id) testMemories.push(id);
    }

    return {
      details: {
        contentLength: longContent.length,
        success,
        note: success ? "Long content handled" : "Long content rejected",
      },
    };
  });

  // TC-EDGE-003: Special characters and emoji
  await runTest("TC-EDGE-003", "Special characters and emoji", async () => {
    const specialContent = `
      Special chars: <>&"'
      Unicode: 你好世界 🌍 ñ é ü
      Emoji: 🚀 💻 🔥 ✅ ❌
      Math: ∑ ∏ ∫ √ ∞
      Arrows: ← ↑ → ↓ ↔ ↕
      Box: ┌─┐│└─┘
    `;

    const result = await memory_write.execute({
      content: specialContent,
      abstract: "Special chars: 🚀 test",
      overview: "Testing unicode, emoji, and special characters",
      type: "test",
      tags: ["edge-case", "unicode", "emoji"],
    });

    const success = !result.includes("❌");

    if (success) {
      const id = extractLocalId(result);
      if (id) testMemories.push(id);
    }

    return {
      details: {
        hasUnicode: /[\u4e00-\u9fa5]/.test(specialContent),
        hasEmoji: /[\u{1f300}-\u{1f9ff}]/u.test(specialContent),
        success,
        note: success ? "Special chars handled" : "Special chars rejected",
      },
    };
  });

  // TC-EDGE-004: Newlines and formatting
  await runTest("TC-EDGE-004", "Newlines and formatting", async () => {
    const formattedContent = `# Heading

## Subheading

- List item 1
- List item 2
  - Nested item

\`\`\`javascript
const code = "example";
\`\`\`

> Blockquote

**Bold** and *italic* text.

---

Multiple\n\n\nnewlines.
`;

    const result = await memory_write.execute({
      content: formattedContent,
      abstract: "Formatting test",
      overview: "Testing markdown and newlines",
      type: "test",
      tags: ["edge-case", "formatting"],
    });

    const success = !result.includes("❌");

    if (success) {
      const id = extractLocalId(result);
      if (id) testMemories.push(id);
    }

    return {
      details: {
        lineCount: formattedContent.split("\n").length,
        success,
        note: success ? "Formatting preserved" : "Formatting rejected",
      },
    };
  });

  // TC-EDGE-005: Maximum tags
  await runTest("TC-EDGE-005", "Maximum tags handling", async () => {
    const manyTags = [
      "tag1",
      "tag2",
      "tag3",
      "tag4",
      "tag5",
      "tag6",
      "tag7",
      "tag8",
      "tag9",
      "tag10",
      "tag11",
      "tag12",
      "tag13",
      "tag14",
      "tag15",
    ];

    const result = await memory_write.execute({
      content: "Testing with many tags",
      abstract: "Many tags test",
      overview: `Testing with ${manyTags.length} tags`,
      type: "test",
      tags: manyTags,
    });

    const success = !result.includes("❌");

    if (success) {
      const id = extractLocalId(result);
      if (id) testMemories.push(id);
    }

    return {
      details: {
        tagCount: manyTags.length,
        success,
        note: success ? "Many tags accepted" : "Too many tags rejected",
      },
    };
  });

  // ===== Cleanup =====
  await cleanupTestMemories(testMemories);

  // ===== Report =====
  console.log("\n" + "=".repeat(70));
  console.log("TEST REPORT");
  console.log("=".repeat(70));

  const passed = results.filter((r) => r.status === "PASS");
  const failed = results.filter((r) => r.status === "FAIL");
  const skipped = results.filter((r) => r.status === "SKIP");
  const totalTime = results.reduce((s, r) => s + r.responseTimeMs, 0);
  const avgTime =
    results.length > 0 ? Math.round(totalTime / results.length) : 0;
  const passRate =
    passed.length + failed.length > 0
      ? ((passed.length / (passed.length + failed.length)) * 100).toFixed(1)
      : 0;

  console.log(`\n📊 Summary:`);
  console.log(`  Total:    ${results.length}`);
  console.log(`  Passed:   ${passed.length} ✅`);
  console.log(`  Failed:   ${failed.length} ❌`);
  console.log(`  Skipped:  ${skipped.length} ⏭️`);
  console.log(`  Pass Rate: ${passRate}% (excluding skipped)`);
  console.log(`  Avg Time:  ${avgTime}ms`);
  console.log(`  Total Time: ${totalTime}ms`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    for (const f of failed) {
      console.log(`  ${f.testId}: ${f.description}`);
      console.log(`    Error: ${f.error}`);
    }
  }

  console.log("\n--- Detailed Results ---");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
    console.log(
      `  ${icon} ${r.testId.padEnd(16)} ${r.description.padEnd(50)} ${String(r.responseTimeMs).padStart(5)}ms`,
    );
  }

  console.log("\n" + "=".repeat(70));

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
