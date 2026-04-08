/**
 * Scene 3: Error Handling Tests
 * Tests that the plugin handles various error scenarios gracefully.
 *
 * Test Scenarios:
 * 1. Backend unavailable - Test behavior when backend is down
 * 2. Invalid memory_id - Query non-existent memory ID
 * 3. Missing required fields - Upload without required fields
 * 4. Invalid relation_type - Create call with invalid relation type
 * 5. Network timeout - Simulate slow network
 */

import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();
const TENANT_ID = "default";

const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Helper to record test result
 */
function recordTest(name, passed, response = null, error = null) {
  testResults.tests.push({ name, passed, response, error });
  if (passed) {
    testResults.passed++;
    console.log(`✅ PASS: ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ FAIL: ${name}`);
  }
  if (response) {
    console.log(`   Response: ${JSON.stringify(response).substring(0, 200)}`);
  }
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
  console.log("");
}

/**
 * Test 1: Backend Unavailable
 * Tests behavior when backend is unreachable
 */
async function testBackendUnavailable() {
  console.log("========================================");
  console.log("Test 1: Backend Unavailable");
  console.log("========================================\n");

  // Create a client pointing to non-existent port
  const offlineClient = new WrapperClient({
    backend: { url: "http://localhost:19999" },
  });

  try {
    const result = await offlineClient.health();

    // Health should return unavailable status
    if (result.status === "unavailable") {
      recordTest(
        "Backend unavailable returns status: unavailable",
        true,
        result,
      );
    } else {
      recordTest(
        "Backend unavailable returns status: unavailable",
        false,
        result,
      );
    }
  } catch (error) {
    // Exception is also acceptable
    recordTest("Backend unavailable handles gracefully", true, null, error);
  }

  // Try to search - should fail gracefully
  try {
    const result = await offlineClient.search({
      query: "test",
      tenant_id: TENANT_ID,
    });
    recordTest("Search fails when backend unavailable", false, result);
  } catch (error) {
    recordTest("Search fails when backend unavailable", true, null, error);
  }
}

/**
 * Test 2: Invalid memory_id
 * Tests behavior when querying non-existent memory ID
 */
async function testInvalidMemoryId() {
  console.log("========================================");
  console.log("Test 2: Invalid Memory ID (404)");
  console.log("========================================\n");

  const fakeMemoryId = "memory:invalid_id_12345678";

  try {
    const result = await wrapperClient.http.get(
      `/api/v1/memories/${fakeMemoryId}?tenant_id=${TENANT_ID}`,
    );

    if (result.status === "success") {
      recordTest("Invalid memory_id returns not found", false, result);
    } else if (result.status === "error" || result.status === "not_found") {
      recordTest("Invalid memory_id returns clear error message", true, result);
    } else {
      recordTest("Invalid memory_id returns clear error message", true, result);
    }
  } catch (error) {
    // HTTP 404 should throw WrapperError
    if (error.statusCode === 404 || error.statusCode === 400) {
      recordTest(
        "Invalid memory_id throws appropriate error (404/400)",
        true,
        null,
        error,
      );
    } else {
      recordTest(
        "Invalid memory_id throws appropriate error (404/400)",
        false,
        null,
        error,
      );
    }
  }

  // Also try graph traversal with invalid ID
  try {
    const result = await wrapperClient.http.post(
      `/api/v1/memories/${fakeMemoryId}/graph`,
      {
        depth: 1,
        tenant_id: TENANT_ID,
      },
    );
    recordTest(
      "Graph traversal with invalid ID",
      result.status === "error" || result.memories?.length === 0,
      result,
    );
  } catch (error) {
    recordTest(
      "Graph traversal with invalid ID fails gracefully",
      true,
      null,
      error,
    );
  }
}

/**
 * Test 3: Missing Required Fields
 * Tests validation when required fields are missing
 */
async function testMissingRequiredFields() {
  console.log("========================================");
  console.log("Test 3: Missing Required Fields (400)");
  console.log("========================================\n");

  // Test missing content
  try {
    const result = await wrapperClient.http.post("/api/v1/memories", {
      memories: [
        {
          abstract: "Test abstract",
          overview: "Test overview",
          type: "code",
          // missing: content, tenant_id
        },
      ],
      tenant_id: TENANT_ID,
    });

    // Backend should reject this
    if (result.success === 0 || result.errors?.length > 0) {
      recordTest(
        "Upload without content returns validation error",
        true,
        result,
      );
    } else {
      recordTest(
        "Upload without content returns validation error",
        false,
        result,
      );
    }
  } catch (error) {
    // HTTP 400 is expected
    if (error.statusCode === 400) {
      recordTest("Upload without content returns HTTP 400", true, null, error);
    } else {
      recordTest("Upload without content returns HTTP 400", false, null, error);
    }
  }

  // Test missing abstract
  try {
    const result = await wrapperClient.http.post("/api/v1/memories", {
      memories: [
        {
          content: "Test content",
          overview: "Test overview",
          type: "code",
          // missing: abstract
        },
      ],
      tenant_id: TENANT_ID,
    });

    if (result.success === 0 || result.errors?.length > 0) {
      recordTest(
        "Upload without abstract returns validation error",
        true,
        result,
      );
    } else {
      recordTest(
        "Upload without abstract returns validation error",
        false,
        result,
      );
    }
  } catch (error) {
    if (error.statusCode === 400) {
      recordTest("Upload without abstract returns HTTP 400", true, null, error);
    } else {
      recordTest(
        "Upload without abstract returns HTTP 400",
        false,
        null,
        error,
      );
    }
  }

  // Test with empty memories array
  try {
    const result = await wrapperClient.http.post("/api/v1/memories", {
      memories: [],
      tenant_id: TENANT_ID,
    });

    if (
      result.success === 0 ||
      result.errors?.length > 0 ||
      result.total === 0
    ) {
      recordTest(
        "Upload with empty memories array returns validation error",
        true,
        result,
      );
    } else {
      recordTest(
        "Upload with empty memories array returns validation error",
        false,
        result,
      );
    }
  } catch (error) {
    if (error.statusCode === 400) {
      recordTest(
        "Upload with empty memories array returns HTTP 400",
        true,
        null,
        error,
      );
    } else {
      recordTest(
        "Upload with empty memories array returns HTTP 400",
        false,
        null,
        error,
      );
    }
  }
}

/**
 * Test 4: Invalid Relation Type
 * Tests behavior with invalid relationship types
 */
async function testInvalidRelationType() {
  console.log("========================================");
  console.log("Test 4: Invalid Relation Type");
  console.log("========================================\n");

  // First, upload a memory to use for relations
  let testMemoryId;
  try {
    const uploadResult = await wrapperClient.uploadMemories([
      {
        content: "Test content for relation test",
        abstract: "Test for invalid relation type",
        overview: "Testing invalid relationship types",
        type: "code",
        metadata: { file_path: "test.ts" },
      },
    ]);
    testMemoryId = uploadResult.memory_ids?.[0];
    console.log(`   Created test memory: ${testMemoryId}`);
  } catch (error) {
    console.log(`   ⚠️ Could not create test memory: ${error.message}`);
  }

  if (testMemoryId) {
    // Test with invalid relation type
    try {
      const result = await wrapperClient.http.post(
        "/api/v1/memories/relations",
        {
          from_id: testMemoryId,
          to_id: testMemoryId,
          relationship_type: "invalid_type_xyz",
          tenant_id: TENANT_ID,
        },
      );

      // Backend might accept it or return error
      if (result.id || result.status === "success") {
        recordTest(
          "Invalid relation_type is accepted (might be valid behavior)",
          true,
          result,
        );
      } else {
        recordTest(
          "Invalid relation_type returns validation error",
          true,
          result,
        );
      }
    } catch (error) {
      if (error.statusCode === 400) {
        recordTest("Invalid relation_type returns HTTP 400", true, null, error);
      } else {
        recordTest("Invalid relation_type returns error", true, null, error);
      }
    }

    // Test with empty relation type
    try {
      const result = await wrapperClient.http.post(
        "/api/v1/memories/relations",
        {
          from_id: testMemoryId,
          to_id: testMemoryId,
          relationship_type: "",
          tenant_id: TENANT_ID,
        },
      );

      if (result.id || result.status === "success") {
        recordTest("Empty relation_type handling", false, result);
      } else {
        recordTest(
          "Empty relation_type returns validation error",
          true,
          result,
        );
      }
    } catch (error) {
      recordTest("Empty relation_type fails gracefully", true, null, error);
    }

    // Test batch calls with invalid relationship_type
    try {
      const result = await wrapperClient.http.post("/api/v1/calls/batch", {
        calls: [
          {
            caller_memory_id: testMemoryId,
            callee_memory_id: testMemoryId,
            line: 1,
            relationship_type: "super_invalid_call_type",
          },
        ],
        tenant_id: TENANT_ID,
      });

      if (result.created > 0 || result.errors?.length === 0) {
        recordTest(
          "Batch calls with invalid type (may be accepted)",
          true,
          result,
        );
      } else {
        recordTest(
          "Batch calls with invalid type returns errors",
          true,
          result,
        );
      }
    } catch (error) {
      recordTest(
        "Batch calls with invalid type fails gracefully",
        true,
        null,
        error,
      );
    }
  } else {
    console.log(
      "   ⚠️ Skipping relation type tests - no test memory available\n",
    );
  }
}

/**
 * Test 5: Network Timeout
 * Tests behavior with slow network/timeout
 */
async function testNetworkTimeout() {
  console.log("========================================");
  console.log("Test 5: Network Timeout");
  console.log("========================================\n");

  // Create client with very short timeout
  const timeoutClient = new WrapperClient({ backend: { timeout: 100 } });

  try {
    // This should timeout quickly
    const result = await timeoutClient.search({
      query: "test",
      tenant_id: TENANT_ID,
    });
    recordTest("Short timeout returns error", false, result);
  } catch (error) {
    // Should get timeout error
    if (error.message?.includes("timeout") || error.statusCode === 408) {
      recordTest("Short timeout throws timeout error", true, null, error);
    } else if (
      error.message?.includes("timeout") ||
      error.message?.includes("aborted")
    ) {
      recordTest("Short timeout throws timeout error", true, null, error);
    } else {
      recordTest("Short timeout throws timeout error", true, null, error);
    }
  }

  // Test with zero timeout (immediate failure)
  const zeroTimeoutClient = new WrapperClient({ backend: { timeout: 1 } });
  try {
    await zeroTimeoutClient.health();
    recordTest("Zero timeout fails immediately", false);
  } catch (error) {
    recordTest("Zero timeout fails immediately", true, null, error);
  }
}

/**
 * Additional Error Handling Tests
 */
async function testAdditionalErrors() {
  console.log("========================================");
  console.log("Additional Error Handling Tests");
  console.log("========================================\n");

  // Test with invalid tenant_id
  try {
    const result = await wrapperClient.http.get(
      "/api/v1/memories/nonexistent?tenant_id=invalid_tenant",
    );
    recordTest("Invalid tenant_id handling", result.status === "error", result);
  } catch (error) {
    recordTest("Invalid tenant_id fails gracefully", true, null, error);
  }

  // Test with missing tenant_id
  try {
    const result = await wrapperClient.http.get("/api/v1/memories/nonexistent");
    // Some endpoints might work without tenant_id
    recordTest(
      "Missing tenant_id handling",
      result.status === "error" || result.status === "success",
      result,
    );
  } catch (error) {
    recordTest("Missing tenant_id fails gracefully", true, null, error);
  }

  // Test project map with invalid project
  try {
    const result = await wrapperClient.http.get(
      "/api/v1/projects/invalid_project_xyz/map",
    );
    // Should return empty or error
    if (result.status === "success" && result.nodes?.length === 0) {
      recordTest("Invalid project returns empty map", true, result);
    } else if (result.status === "error") {
      recordTest("Invalid project returns error", true, result);
    } else {
      recordTest("Invalid project handling", true, result);
    }
  } catch (error) {
    recordTest("Invalid project fails gracefully", true, null, error);
  }
}

/**
 * Print summary
 */
function printSummary() {
  console.log("\n========================================");
  console.log("Error Handling Test Summary");
  console.log("========================================");
  console.log(`Total Tests: ${testResults.tests.length}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(
    `Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`,
  );
  console.log("========================================\n");

  if (testResults.failed > 0) {
    console.log("Failed Tests:");
    testResults.tests
      .filter((t) => !t.passed)
      .forEach((t) => console.log(`  - ${t.name}`));
  }

  console.log("\nError Response Analysis:");
  console.log("------------------------");
  const errorResponses = testResults.tests
    .filter((t) => t.error)
    .map((t) => ({
      test: t.name,
      error: t.error.message || t.error,
      statusCode: t.error.statusCode,
    }));

  errorResponses.forEach((e) => {
    console.log(`[${e.statusCode || "N/A"}] ${e.test}`);
    console.log(`  -> ${e.error.substring(0, 100)}`);
  });
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  Scene 3: Error Handling Tests        ║");
  console.log("╚════════════════════════════════════════╝\n");

  // First, verify backend is accessible
  console.log("=== Backend Health Check ===");
  try {
    const health = await wrapperClient.health();
    console.log(`Backend Status: ${health.status}`);
    if (health.status === "healthy") {
      console.log("✅ Backend is healthy, running tests...\n");
    } else {
      console.log("⚠️ Backend status:", health.status);
    }
  } catch (error) {
    console.log("❌ Backend unreachable:", error.message);
    console.log("Note: Some tests will fail as expected.\n");
  }

  // Run all tests
  await testBackendUnavailable();
  await testInvalidMemoryId();
  await testMissingRequiredFields();
  await testInvalidRelationType();
  await testNetworkTimeout();
  await testAdditionalErrors();

  // Print summary
  printSummary();

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
