/**
 * Backend Fixes Verification Script
 *
 * Tests all 4 backend fixes:
 * 1. Field name unified: abstract/overview (not content_abstract/content_overview)
 * 2. New code files properly inserted (was skipping due to continue statement)
 * 3. Code data skips deduplication when type: "code"
 * 4. SurrealDB syntax fixed: metadata.file_path (not metadata->file_path)
 */

import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

// Use 'default' tenant to match backend's expected tenant
const clientConfig = { backend: { tenant_id: "default" } };
const wrapperClient = new WrapperClient(clientConfig);
const TENANT_ID = "default";

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, details = "") {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
  console.log(`${status}: ${name}${details ? "\n   " + details : ""}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ==================== TEST 1: Field Name Unification ====================
async function testFieldNameUnification() {
  console.log("\n=== TEST 1: Field Name Unification (abstract/overview) ===");

  const timestamp = Date.now();
  const payload = {
    memories: [
      {
        type: "code",
        content: `// Test file for field name verification ${timestamp}`,
        abstract: "Test abstract field", // Should be this, not content_abstract
        overview: "Test overview field", // Should be this, not content_overview
        project_id: "test-project",
        metadata: {
          file_path: `src/field_test_${timestamp}.ts`,
          language: "typescript",
        },
      },
    ],
    tenant_id: "default",
  };

  try {
    const uploadResult = await wrapperClient.http.post(
      "/api/v1/memories",
      payload,
    );

    if (uploadResult.success === 1 && uploadResult.memory_ids?.[0]) {
      const memoryId = uploadResult.memory_ids[0];
      logTest(
        "Upload with abstract/overview fields",
        true,
        `memory_id: ${memoryId}`,
      );

      await sleep(2000);

      // Query the memory to verify fields are stored correctly
      const queryResult = await wrapperClient.http.get(
        `/api/v1/memories/${memoryId}?tenant_id=${TENANT_ID}`,
      );

      if (queryResult.status === "success" && queryResult.memory) {
        const mem = queryResult.memory;
        const hasAbstract = mem.abstract === "Test abstract field";
        const hasOverview = mem.overview === "Test overview field";

        logTest(
          "Query returns correct abstract",
          hasAbstract,
          hasAbstract
            ? `Got: "${mem.abstract}"`
            : `Expected "Test abstract field", got "${mem.abstract}"`,
        );
        logTest(
          "Query returns correct overview",
          hasOverview,
          hasOverview
            ? `Got: "${mem.overview}"`
            : `Expected "Test overview field", got "${mem.overview}"`,
        );

        // Verify no content_abstract/content_overview
        const hasWrongFields = mem.content_abstract || mem.content_overview;
        logTest(
          "No wrong field names (content_abstract/content_overview)",
          !hasWrongFields,
        );

        return memoryId;
      } else {
        logTest(
          "Query returns correct abstract",
          false,
          "Query failed: " + JSON.stringify(queryResult),
        );
        logTest("Query returns correct overview", false, "Query failed");
        return null;
      }
    } else {
      logTest(
        "Upload with abstract/overview fields",
        false,
        "Upload failed: " + JSON.stringify(uploadResult),
      );
      return null;
    }
  } catch (error) {
    logTest("Upload with abstract/overview fields", false, error.message);
    return null;
  }
}

// ==================== TEST 2: New Code Files Insertion ====================
async function testNewCodeFilesInsertion() {
  console.log("\n=== TEST 2: New Code Files Insertion (no skip) ===");

  const timestamp = Date.now();
  const uniqueContent = `// Brand new code file ${timestamp}
export function brandNewFunction${timestamp}() {
  console.log('This is a brand new function');
  return true;
}`;

  try {
    const uploadResult = await wrapperClient.uploadMemories([
      {
        type: "code",
        content: uniqueContent,
        abstract: "Brand new function insertion test",
        overview: "Testing that new code files are not skipped",
        project_id: "test-project",
        metadata: {
          file_path: `src/brand_new_${timestamp}.ts`,
          language: "typescript",
        },
      },
    ]);

    if (uploadResult.memory_ids?.[0]) {
      const memoryId = uploadResult.memory_ids[0];
      logTest(
        "New code file upload returns memory_id",
        true,
        `memory_id: ${memoryId}`,
      );

      // Wait longer for SurrealDB to process
      await sleep(3000);

      // Use search API as fallback verification
      const searchResult = await wrapperClient.http.post(
        "/api/v1/memories/search",
        {
          query: "brandNewFunction",
          limit: 5,
          tenant_id: TENANT_ID,
          mode: "keyword",
        },
      );

      const existsViaSearch = searchResult.results?.some(
        (r) => r.id === memoryId,
      );
      logTest(
        "New code file exists via search",
        existsViaSearch,
        existsViaSearch ? "Found via search API" : "Not found via search API",
      );

      // Also try direct query
      try {
        const queryResult = await wrapperClient.http.get(
          `/api/v1/memories/${memoryId}?tenant_id=${TENANT_ID}`,
        );
        const exists = queryResult.status === "success";
        logTest(
          "New code file is queryable via GET",
          exists,
          exists ? "Found via GET API" : "Not found via GET API (404)",
        );
      } catch (e) {
        logTest("New code file is queryable via GET", false, e.message);
      }

      return memoryId;
    } else if (uploadResult.skipped?.length > 0) {
      logTest(
        "New code file upload returns memory_id",
        false,
        `Was skipped: ${uploadResult.skipped[0].reason}`,
      );
      return null;
    } else {
      logTest("New code file upload returns memory_id", false, "Unknown error");
      return null;
    }
  } catch (error) {
    logTest("New code file upload returns memory_id", false, error.message);
    return null;
  }
}

// ==================== TEST 3: Code Type Skips Deduplication ====================
async function testCodeTypeSkipsDedup() {
  console.log("\n=== TEST 3: Code Type Skips Deduplication ===");

  const timestamp = Date.now();
  const codeContent = `// Duplicate code test ${timestamp}
export function duplicateTest${timestamp}() {
  return 'duplicate';
}`;

  // First upload
  try {
    const firstUpload = await wrapperClient.uploadMemories([
      {
        type: "code",
        content: codeContent,
        abstract: "Duplicate code test 1",
        overview: "First upload of duplicate code",
        project_id: "test-project",
        metadata: {
          file_path: `src/dup_test_${timestamp}.ts`,
          language: "typescript",
        },
      },
    ]);

    const firstMemoryId = firstUpload.memory_ids?.[0];

    if (!firstMemoryId) {
      logTest("First code upload", false, "No memory_id returned");
      return;
    }

    logTest(
      "First code upload returns memory_id",
      true,
      `memory_id: ${firstMemoryId}`,
    );
    await sleep(3000);

    // Second upload of same content - should NOT be skipped because type is 'code'
    const secondUpload = await wrapperClient.uploadMemories([
      {
        type: "code",
        content: codeContent,
        abstract: "Duplicate code test 2",
        overview: "Second upload of same code (should not be skipped)",
        project_id: "test-project",
        metadata: {
          file_path: `src/dup_test_${timestamp}.ts`,
          language: "typescript",
        },
      },
    ]);

    // For type='code', it should skip dedup and insert anyway
    // The key is that we should get a memory_id back (not skipped)
    if (secondUpload.memory_ids?.[0]) {
      const secondMemoryId = secondUpload.memory_ids[0];
      logTest(
        'Duplicate code type="code" is NOT skipped',
        true,
        `Second memory_id: ${secondMemoryId} (different from first: ${secondMemoryId !== firstMemoryId})`,
      );

      // Wait for processing
      await sleep(3000);

      // Verify via search API (more reliable than direct query)
      const searchResult = await wrapperClient.http.post(
        "/api/v1/memories/search",
        {
          query: "duplicateTest",
          limit: 10,
          tenant_id: TENANT_ID,
          mode: "keyword",
        },
      );

      const foundIds = searchResult.results?.map((r) => r.id) || [];
      const firstExists = foundIds.includes(firstMemoryId);
      const secondExists = foundIds.includes(secondMemoryId);

      logTest("First memory exists via search", firstExists);
      logTest("Second memory exists via search", secondExists);
    } else if (secondUpload.skipped?.length > 0) {
      logTest(
        'Duplicate code type="code" is NOT skipped',
        false,
        `Was incorrectly skipped: ${secondUpload.skipped[0].reason}`,
      );
    } else {
      logTest(
        'Duplicate code type="code" is NOT skipped',
        false,
        "Unknown error",
      );
    }
  } catch (error) {
    logTest("Code type dedup test", false, error.message);
  }
}

// ==================== TEST 4: SurrealDB metadata.file_path ====================
async function testSurrealDBMetadataFilePath() {
  console.log("\n=== TEST 4: SurrealDB metadata.file_path Syntax ===");

  const timestamp = Date.now();
  const metadataFilePath = `src/metadata_test_${timestamp}.ts`;

  try {
    const uploadResult = await wrapperClient.http.post("/api/v1/memories", {
      memories: [
        {
          type: "code",
          content: `// Metadata test ${timestamp}
export function metadataTest${timestamp}() {
  return 'metadata test';
}`,
          abstract: "SurrealDB metadata.file_path test",
          overview: "Verifying metadata.file_path is stored correctly",
          project_id: "test-project",
          metadata: {
            file_path: metadataFilePath,
            language: "typescript",
            custom_field: "custom_value",
          },
        },
      ],
      tenant_id: TENANT_ID,
    });

    if (uploadResult.success === 1 && uploadResult.memory_ids?.[0]) {
      const memoryId = uploadResult.memory_ids[0];
      logTest("Upload with metadata.file_path", true, `memory_id: ${memoryId}`);

      await sleep(2000);

      const queryResult = await wrapperClient.http.get(
        `/api/v1/memories/${memoryId}?tenant_id=${TENANT_ID}`,
      );

      if (queryResult.status === "success" && queryResult.memory) {
        const mem = queryResult.memory;
        const storedPath = mem.metadata?.file_path;
        const pathMatches = storedPath === metadataFilePath;

        logTest(
          "metadata.file_path stored correctly",
          pathMatches,
          pathMatches
            ? `Got: "${storedPath}"`
            : `Expected "${metadataFilePath}", got "${storedPath}"`,
        );

        const hasMetadata = !!mem.metadata && typeof mem.metadata === "object";
        logTest("metadata object accessible", hasMetadata);

        if (mem.metadata?.custom_field) {
          const customMatches = mem.metadata.custom_field === "custom_value";
          logTest("metadata.custom_field stored correctly", customMatches);
        }

        return memoryId;
      } else {
        logTest(
          "metadata.file_path stored correctly",
          false,
          "Query failed or no memory",
        );
        return null;
      }
    } else {
      logTest(
        "Upload with metadata.file_path",
        false,
        "Upload failed: " + JSON.stringify(uploadResult),
      );
      return null;
    }
  } catch (error) {
    logTest("Upload with metadata.file_path", false, error.message);
    return null;
  }
}

// ==================== TEST 5: Complete Integration Test ====================
async function testCompleteIntegration() {
  console.log("\n=== TEST 5: Complete Integration Test ===");

  const timestamp = Date.now();
  const payload = {
    memories: [
      {
        type: "code",
        content: `// Complete integration test ${timestamp}
export class IntegrationTest${timestamp} {
  constructor() {
    this.data = [];
  }
  
  add(item) {
    this.data.push(item);
    return this;
  }
  
  getAll() {
    return [...this.data];
  }
}`,
        abstract: "Complete integration test",
        overview: "Full test with all fields and metadata",
        project_id: "test-project",
        metadata: {
          file_path: `src/integration_test_${timestamp}.ts`,
          language: "typescript",
          code_analysis: {
            language: "typescript",
            functions: [
              { name: "add", line: 8 },
              { name: "getAll", line: 13 },
            ],
            classes: [{ name: `IntegrationTest${timestamp}`, line: 3 }],
          },
        },
      },
    ],
    tenant_id: "default",
  };

  try {
    // Upload
    const uploadResult = await wrapperClient.http.post(
      "/api/v1/memories",
      payload,
    );

    if (uploadResult.success !== 1 || !uploadResult.memory_ids?.[0]) {
      logTest(
        "Complete integration upload",
        false,
        "Upload failed: " + JSON.stringify(uploadResult),
      );
      return null;
    }

    const memoryId = uploadResult.memory_ids[0];
    logTest("Complete integration upload", true, `memory_id: ${memoryId}`);

    await sleep(2000);

    // Query
    const queryResult = await wrapperClient.http.get(
      `/api/v1/memories/${memoryId}?tenant_id=${TENANT_ID}`,
    );

    if (queryResult.status !== "success" || !queryResult.memory) {
      logTest("Complete integration query", false, "Query failed");
      return memoryId;
    }

    logTest("Complete integration query", true);

    const mem = queryResult.memory;

    // Verify all fields
    const checks = [
      { name: "type is code", pass: mem.type === "code" },
      {
        name: "abstract is correct",
        pass: mem.abstract === "Complete integration test",
      },
      {
        name: "overview is correct",
        pass: mem.overview === "Full test with all fields and metadata",
      },
      {
        name: "project_id is correct",
        pass: mem.project_id === "test-project",
      },
      {
        name: "content includes code",
        pass: mem.content?.includes("IntegrationTest"),
      },
      { name: "metadata.file_path exists", pass: !!mem.metadata?.file_path },
      {
        name: "code_analysis.functions exists",
        pass: !!mem.metadata?.code_analysis?.functions,
      },
      {
        name: "code_analysis.classes exists",
        pass: !!mem.metadata?.code_analysis?.classes,
      },
    ];

    checks.forEach((check) => {
      logTest(check.name, check.pass);
    });

    return memoryId;
  } catch (error) {
    logTest("Complete integration test", false, error.message);
    return null;
  }
}

// ==================== MAIN ====================
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Backend Fixes Verification Script                   ║");
  console.log("║                                                          ║");
  console.log("║  Testing 4 fixes:                                        ║");
  console.log("║  1. Field name: abstract/overview                        ║");
  console.log("║  2. New code files insertion (no skip)                  ║");
  console.log('║  3. type="code" skips deduplication                     ║');
  console.log("║  4. SurrealDB: metadata.file_path syntax                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  await testFieldNameUnification();
  await testNewCodeFilesInsertion();
  await testCodeTypeSkipsDedup();
  await testSurrealDBMetadataFilePath();
  await testCompleteIntegration();

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    TEST SUMMARY                           ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  ✅ Passed: ${results.passed}`);
  console.log(`  ❌ Failed: ${results.failed}`);
  console.log(`  📊 Total:  ${results.passed + results.failed}`);

  if (results.failed === 0) {
    console.log("\n🎉 All backend fixes verified successfully!\n");
  } else {
    console.log("\n⚠️  Some tests failed. Review details above.\n");
  }

  // List failed tests
  if (results.failed > 0) {
    console.log("Failed tests:");
    results.tests
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`  - ${t.name}`);
      });
  }
}

main().catch(console.error);
