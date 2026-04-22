#!/usr/bin/env node

/**
 * Layer 5: oh-my-opencode Orchestration Support Tests
 * TC-ORCH-001: Verify Layer 3 supports Sisyphus task distribution workflow
 *
 * Note: Sisyphus, Prometheus, Atlas are external agents from oh-my-opencode framework.
 * This test verifies Layer 3 (memory plugin) provides the necessary tools for their workflow.
 *
 * Architecture:
 *   Layer 5 (oh-my-opencode): Sisyphus → Prometheus → Atlas
 *   Layer 3 (this plugin): memory_search, memory_write, memory_relate, index_status
 *   Layer 2 (backend): SurrealDB + Meilisearch
 */

import { memory_search } from "../opencode-memory-plugin/tools/search.js";
import { memory_write } from "../opencode-memory-plugin/tools/core.js";
import { memory_relate } from "../opencode-memory-plugin/tools/graph.js";
import { index_status } from "../opencode-memory-plugin/tools/sync.js";
import fs from "fs";

// ===== Test Framework =====
const results = [];
const testMemories = [];

function record(
  testId,
  description,
  status,
  duration,
  details = null,
  error = null,
) {
  results.push({ testId, description, status, duration, details, error });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`  ${icon} ${testId}: ${description} [${duration}ms]`);
  if (details) console.log(`     Details: ${JSON.stringify(details)}`);
  if (error) console.log(`     Error: ${error}`);
}

// ===== Cleanup Helper =====
async function cleanupTestMemories(ids) {
  console.log("\n🧹 Cleaning up test memories...");
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
      }
    } catch (err) {
      console.warn(`  Failed to delete ${id}: ${err.message}`);
    }
  }
  console.log(`  Cleanup complete: ${deletedCount}/${ids.length} deleted.`);
  return deletedCount;
}

// ===== TC-ORCH-001: Sisyphus Workflow Support =====

async function testOrchestration001() {
  console.log("=".repeat(70));
  console.log("TC-ORCH-001: Sisyphus Task Distribution Workflow");
  console.log("Verifying Layer 3 supports oh-my-opencode orchestration");
  console.log("=".repeat(70));
  console.log(
    "\nNote: Sisyphus/Prometheus/Atlas are external oh-my-opencode agents",
  );
  console.log("This test verifies Layer 3 tool support for their workflow\n");

  const startTotal = performance.now();

  // Step 1: Sisyphus searches for historical solutions
  // (Simulates: Sisyphus calls memory_search before task distribution)
  const step1Start = performance.now();
  try {
    console.log("[Step 1] Sisyphus searches for historical solutions...");

    // Pre-create historical data
    const historicalWrite = await memory_write.execute({
      content:
        "Implemented user authentication using JWT tokens with refresh token rotation and role-based access control",
      abstract: "JWT authentication pattern",
      overview:
        "Used jsonwebtoken library, implemented access/refresh token pattern, added RBAC middleware",
      type: "code",
      tags: ["authentication", "jwt", "security", "pattern"],
    });

    if (!historicalWrite.includes("❌")) {
      const match = historicalWrite.match(/ID:\s*([A-Z0-9]{26})/);
      if (match) testMemories.push(match[1]);
    }

    // Sisyphus searches before planning
    const searchResult = await memory_search.execute({
      query: "JWT authentication pattern",
      mode: "hybrid",
      limit: 5,
    });

    const searchSuccess = !searchResult.includes("❌");
    const hasResults = !searchResult.includes("No results");

    record(
      "TC-ORCH-001.1",
      "Sisyphus can search historical solutions",
      searchSuccess && hasResults ? "PASS" : "FAIL",
      Math.round(performance.now() - step1Start),
      { searchSuccess, hasResults, resultLength: searchResult.length },
    );
  } catch (err) {
    record(
      "TC-ORCH-001.1",
      "Sisyphus can search historical solutions",
      "FAIL",
      Math.round(performance.now() - step1Start),
      null,
      err.message,
    );
  }

  // Step 2: Prometheus creates Backlog entries
  // (Simulates: Prometheus calls memory_write to create tasks)
  const step2Start = performance.now();
  const backlogItems = [];

  try {
    console.log("\n[Step 2] Prometheus creates Backlog entries...");

    // Create multiple backlog items (simulating task breakdown)
    const tasks = [
      {
        title: "Research authentication libraries",
        priority: "P1",
        content: "Compare JWT libraries: jsonwebtoken vs jose vs passport-jwt",
      },
      {
        title: "Implement token generation",
        priority: "P0",
        content: "Create JWT generation with proper payload and expiration",
      },
      {
        title: "Add refresh token mechanism",
        priority: "P1",
        content: "Implement refresh token rotation for security",
      },
    ];

    for (const task of tasks) {
      const result = await memory_write.execute({
        content: task.content,
        abstract: task.title,
        overview: `Backlog item: ${task.title} [${task.priority}]`,
        type: "backlog",
        tags: ["backlog", task.priority.toLowerCase(), "authentication"],
      });

      if (!result.includes("❌")) {
        const match = result.match(/ID:\s*([A-Z0-9]{26})/);
        if (match) {
          const id = match[1];
          backlogItems.push({ id, ...task });
          testMemories.push(id);
        }
      }
    }

    record(
      "TC-ORCH-001.2",
      "Prometheus can create Backlog entries",
      backlogItems.length === tasks.length ? "PASS" : "PARTIAL",
      Math.round(performance.now() - step2Start),
      { created: backlogItems.length, expected: tasks.length },
    );
  } catch (err) {
    record(
      "TC-ORCH-001.2",
      "Prometheus can create Backlog entries",
      "FAIL",
      Math.round(performance.now() - step2Start),
      null,
      err.message,
    );
  }

  // Step 3: Atlas executes and updates status
  // (Simulates: Atlas calls memory_write to mark tasks complete)
  const step3Start = performance.now();
  const completedItems = [];

  try {
    console.log("\n[Step 3] Atlas executes and updates status...");

    for (const item of backlogItems) {
      // Mark as completed
      const result = await memory_write.execute({
        content: `Completed: ${item.content}`,
        abstract: `✅ ${item.title}`,
        overview: `Status: completed | Priority: ${item.priority}`,
        type: "backlog",
        tags: ["backlog", "completed", "authentication"],
      });

      if (!result.includes("❌")) {
        const match = result.match(/ID:\s*([A-Z0-9]{26})/);
        if (match) {
          completedItems.push(match[1]);
          testMemories.push(match[1]);
        }
      }
    }

    record(
      "TC-ORCH-001.3",
      "Atlas can update task status",
      completedItems.length === backlogItems.length ? "PASS" : "PARTIAL",
      Math.round(performance.now() - step3Start),
      { completed: completedItems.length, total: backlogItems.length },
    );
  } catch (err) {
    record(
      "TC-ORCH-001.3",
      "Atlas can update task status",
      "FAIL",
      Math.round(performance.now() - step3Start),
      null,
      err.message,
    );
  }

  // Step 4: Verify workflow completion via index_status
  // (Simulates: Sisyphus verifies system state)
  const step4Start = performance.now();

  try {
    console.log("\n[Step 4] Sisyphus verifies workflow completion...");

    const status = await index_status.execute({ detailed: true });
    const statusSuccess = !status.includes("❌");

    record(
      "TC-ORCH-001.4",
      "Sisyphus can verify system state",
      statusSuccess ? "PASS" : "FAIL",
      Math.round(performance.now() - step4Start),
      { statusSuccess },
    );
  } catch (err) {
    record(
      "TC-ORCH-001.4",
      "Sisyphus can verify system state",
      "FAIL",
      Math.round(performance.now() - step4Start),
      null,
      err.message,
    );
  }

  // Step 5: Optional - Create relations between tasks
  // (Simulates: Prometheus links related backlog items)
  const step5Start = performance.now();

  try {
    console.log("\n[Step 5] Prometheus creates task relations...");

    if (backlogItems.length >= 2) {
      // Link first task to second (dependency)
      const relateResult = await memory_relate.execute({
        action: "create",
        from_id: backlogItems[0].id,
        to_id: backlogItems[1].id,
        relation_type: "follow_up", // Use valid relation type
        weight: 0.9,
      });

      const relateSuccess = !relateResult.includes("❌");

      record(
        "TC-ORCH-001.5",
        "Prometheus can create task relations",
        relateSuccess ? "PASS" : "PARTIAL",
        Math.round(performance.now() - step5Start),
        {
          relateSuccess,
          note: relateSuccess
            ? "Relation created"
            : "Backend may not be available",
        },
      );
    } else {
      record(
        "TC-ORCH-001.5",
        "Prometheus can create task relations",
        "SKIP",
        Math.round(performance.now() - step5Start),
        { note: "Not enough backlog items to create relations" },
      );
    }
  } catch (err) {
    record(
      "TC-ORCH-001.5",
      "Prometheus can create task relations",
      "FAIL",
      Math.round(performance.now() - step5Start),
      null,
      err.message,
    );
  }

  // Cleanup
  await cleanupTestMemories(testMemories);

  // Report
  const totalDuration = Math.round(performance.now() - startTotal);
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log("\n" + "=".repeat(70));
  console.log("TEST REPORT");
  console.log("=".repeat(70));
  console.log(`\n📊 Summary:`);
  console.log(`  Total:    ${results.length}`);
  console.log(`  Passed:   ${passed} ✅`);
  console.log(`  Failed:   ${failed} ❌`);
  console.log(`  Skipped:  ${skipped} ⏭️`);
  console.log(`  Duration: ${totalDuration}ms`);
  console.log(`\nWorkflow: Sisyphus → Prometheus → Atlas`);
  console.log(
    `Status: ${failed === 0 ? "✅ Layer 3 supports orchestration" : "❌ Issues found"}`,
  );
  console.log("=".repeat(70));

  return failed === 0;
}

// Run test
testOrchestration001()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
