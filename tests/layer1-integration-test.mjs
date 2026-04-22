#!/usr/bin/env node

/**
 * Layer 1: Data Layer Integration Tests
 * Tests all Atom/Entity/Reference CRUD operations with Schema alignment (BL-CA-48)
 *
 * Usage: node tests/layer1-integration-test.mjs
 */

import {
  WrapperClient,
  WrapperError,
  DuplicateError,
} from "../opencode-memory-plugin/lib/wrapper-client.js";

const TENANT_ID = "default";
const PROJECT_ID = "test-layer1-" + Date.now();
const API_KEY = process.env.WRAPPER_MEILI_API_KEY || "";

// ===== Test Framework =====
const results = [];

function record(
  testId,
  description,
  status,
  responseTimeMs,
  schema = null,
  error = null,
) {
  results.push({ testId, description, status, responseTimeMs, schema, error });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  const extra = error ? ` | Error: ${error}` : "";
  const schemaStr = schema ? ` | Schema: ${JSON.stringify(schema)}` : "";
  console.log(
    `  ${icon} ${testId}: ${description} [${responseTimeMs}ms]${schemaStr}${extra}`,
  );
}

async function runTest(testId, description, fn) {
  const start = performance.now();
  try {
    const { schema, ...rest } = await fn();
    const ms = Math.round(performance.now() - start);
    record(testId, description, "PASS", ms, schema);
    return rest;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    record(testId, description, "FAIL", ms, null, err.message || String(err));
    return null;
  }
}

function skip(testId, description, reason) {
  record(testId, description, "SKIP", 0, null, reason);
}

// ===== Client Setup =====
const client = new WrapperClient({
  backend: {
    url: "http://localhost:18008",
    tenant_id: TENANT_ID,
    timeout: 15000,
    max_retries: 1,
  },
});

// Override http to include API key header
const origRequest = client.http.request.bind(client.http);
client.http.request = async function (
  method,
  endpoint,
  body = null,
  headers = {},
) {
  return origRequest(method, endpoint, body, {
    ...headers,
    WRAPPER_MEILI_API_KEY: API_KEY,
  });
};

// Store created IDs for cleanup
const createdIds = { atoms: [], entities: [], references: [] };

async function cleanup() {
  console.log("\n🧹 Cleanup: deleting all created test resources...");
  for (let i = 0; i < createdIds.references.length; i++) {
    try {
      await client.deleteReference(createdIds.references[i]);
    } catch {}
  }
  for (let i = 0; i < createdIds.atoms.length; i++) {
    try {
      await client.deleteAtom(createdIds.atoms[i]);
    } catch {}
  }
  for (let i = 0; i < createdIds.entities.length; i++) {
    try {
      await client.http.delete(
        `/api/v1/entities/${createdIds.entities[i]}?tenant_id=${TENANT_ID}`,
      );
    } catch {}
  }
  console.log("  Cleanup complete.");
}

// ===== Test Suite =====

async function main() {
  console.log("=".repeat(70));
  console.log("Layer 1: Data Layer Integration Tests");
  console.log("Schema Alignment: BL-CA-48");
  console.log(`Tenant: ${TENANT_ID} | Project: ${PROJECT_ID}`);
  console.log("=".repeat(70));

  // ===== 0. Health Check =====
  console.log("\n--- Phase 0: Backend Health Check ---");
  const healthStart = performance.now();
  try {
    const health = await client.health();
    const healthMs = Math.round(performance.now() - healthStart);
    if (health.status === "healthy") {
      record("TC-HEALTH-001", "Backend health check", "PASS", healthMs);
    } else {
      record(
        "TC-HEALTH-001",
        "Backend health check",
        "FAIL",
        healthMs,
        null,
        `status=${health.status}`,
      );
      console.log("\n❌ Backend not healthy. Aborting tests.");
      process.exit(1);
    }
  } catch (err) {
    record(
      "TC-HEALTH-001",
      "Backend health check",
      "FAIL",
      0,
      null,
      err.message,
    );
    console.log("\n❌ Cannot connect to backend. Aborting tests.");
    process.exit(1);
  }

  // ===== 1. Atom Tests =====
  console.log("\n--- Phase 1: Atom CRUD Tests ---");

  // TC-ATOM-001: Create Atom - function type with docstring object format
  const atomFunc = await runTest(
    "TC-ATOM-001",
    "Create Atom - function with docstring object",
    async () => {
      const data = {
        type: "function",
        name: "testCalculateSum",
        content: "function testCalculateSum(a, b) { return a + b; }",
        signature: "testCalculateSum(a: number, b: number): number",
        params: [
          { name: "a", type: "number" },
          { name: "b", type: "number" },
        ],
        return_type: "number",
        is_exported: true,
        is_async: false,
        start_line: 1,
        end_line: 5,
        docstring: {
          text: "Calculates the sum of two numbers",
          params: [
            { name: "a", description: "First number" },
            { name: "b", description: "Second number" },
          ],
          returns: "The sum of a and b",
        },
        project: PROJECT_ID,
        tenant_id: TENANT_ID,
      };
      const result = await client.createAtom(data);
      createdIds.atoms.push(result.id);
      return {
        schema: { hasId: !!result.id, type: result.type, name: result.name },
        id: result.id,
      };
    },
  );

  // TC-ATOM-002: Create Atom - class type with docstring object format
  const atomClass = await runTest(
    "TC-ATOM-002",
    "Create Atom - class with docstring object",
    async () => {
      const data = {
        type: "class",
        name: "TestUserService",
        content: "class TestUserService { constructor() {} }",
        start_line: 10,
        end_line: 50,
        docstring: {
          text: "Service for managing users",
          author: "test-author",
          version: "1.0.0",
        },
        project: PROJECT_ID,
        tenant_id: TENANT_ID,
      };
      const result = await client.createAtom(data);
      createdIds.atoms.push(result.id);
      return {
        schema: { hasId: !!result.id, type: result.type, name: result.name },
        id: result.id,
      };
    },
  );

  // TC-ATOM-003: Batch create 100 Atoms
  await runTest("TC-ATOM-003", "Batch create 100 Atoms", async () => {
    const batchSize = 100;
    const atomIds = [];
    for (let i = 0; i < batchSize; i++) {
      const result = await client.createAtom({
        type: "function",
        name: `batchFunc_${i}`,
        content: `function batchFunc_${i}() {}`,
        project: PROJECT_ID,
        tenant_id: TENANT_ID,
      });
      atomIds.push(result.id);
      createdIds.atoms.push(result.id);
    }
    return { schema: { created: atomIds.length, expected: batchSize } };
  });

  // TC-ATOM-004: Get Atom by ID
  await runTest("TC-ATOM-004", "Get Atom by ID", async () => {
    if (!atomFunc) throw new Error("TC-ATOM-001 failed, no atom ID");
    const result = await client.getAtom(atomFunc.id, TENANT_ID);
    return {
      schema: {
        hasId: !!result.id,
        type: result.type,
        name: result.name,
        hasDocstring: !!result.docstring,
      },
    };
  });

  // TC-ATOM-005: Update Atom
  await runTest("TC-ATOM-005", "Update Atom", async () => {
    if (!atomFunc) throw new Error("TC-ATOM-001 failed, no atom ID");
    const result = await client.updateAtom(atomFunc.id, {
      name: "testCalculateSumV2",
      complexity: 3,
      status: "active",
      tenant_id: TENANT_ID,
    });
    return { schema: { updated: true, hasId: !!result.id } };
  });

  // TC-ATOM-006: Delete Atom
  await runTest("TC-ATOM-006", "Delete Atom", async () => {
    // Create a throwaway atom then delete it
    const temp = await client.createAtom({
      type: "function",
      name: "toBeDeleted",
      content: "function toBeDeleted() {}",
      tenant_id: TENANT_ID,
    });
    const result = await client.deleteAtom(temp.id, TENANT_ID);
    // Verify it's gone
    try {
      await client.getAtom(temp.id, TENANT_ID);
      throw new Error("Atom still exists after deletion");
    } catch (err) {
      if (
        err.statusCode === 404 ||
        err.message.includes("not found") ||
        err.message.includes("Atom still exists")
      ) {
        if (err.message.includes("still exists")) throw err;
        return { schema: { deleted: true, verifiedGone: true } };
      }
      throw err;
    }
  });

  // TC-ATOM-007: Create duplicate Atom (expect 409 or upsert)
  await runTest(
    "TC-ATOM-007",
    "Create duplicate Atom (expect 409/upsert)",
    async () => {
      const dupData = {
        type: "function",
        name: "uniqueDupTest_" + Date.now(),
        content: "function uniqueDupTest() { return 1; }",
        tenant_id: TENANT_ID,
      };
      // Create first
      const first = await client.createAtom(dupData);
      createdIds.atoms.push(first.id);
      // Try create again with same content
      try {
        const second = await client.createAtom(dupData);
        createdIds.atoms.push(second.id);
        return {
          schema: { behavior: "upsert", gotNewId: second.id !== first.id },
        };
      } catch (err) {
        if (err.statusCode === 409 || err instanceof DuplicateError) {
          return {
            schema: { behavior: "reject_409", statusCode: err.statusCode },
          };
        }
        throw err;
      }
    },
  );

  // ===== 2. Entity Tests =====
  console.log("\n--- Phase 2: Entity CRUD Tests ---");

  // TC-ENTITY-001: Create Entity - code file type with overview object format
  const entityCode = await runTest(
    "TC-ENTITY-001",
    "Create Entity - code file with overview object",
    async () => {
      const data = {
        type: "code",
        abstract: "Test utility module with math helpers",
        overview: {
          text: "Contains utility functions for mathematical operations including sum, average, and factorial calculations.",
          language: "en",
        },
        atoms: atomFunc ? [atomFunc.id] : [],
        tags: ["javascript", "utilities", "math"],
        project: PROJECT_ID,
        file_path: "src/utils/math.js",
        language: "javascript",
        quality_score: 92,
        complexity_metrics: { cyclomatic: 3, lines_of_code: 45, functions: 5 },
        tenant_id: TENANT_ID,
      };
      const result = await client.createEntity(data);
      createdIds.entities.push(result.id);
      return {
        schema: { hasId: !!result.id, type: result.type },
        id: result.id,
      };
    },
  );

  // TC-ENTITY-002: Create Entity - memory type
  const entityMemory = await runTest(
    "TC-ENTITY-002",
    "Create Entity - memory type",
    async () => {
      const data = {
        type: "memory",
        abstract: "User prefers TypeScript for new features",
        overview: {
          text: "Strong preference for TypeScript in all new development work",
          language: "en",
        },
        tags: ["preference", "typescript"],
        project: PROJECT_ID,
        created_by: "integration-test",
        tenant_id: TENANT_ID,
      };
      const result = await client.createEntity(data);
      createdIds.entities.push(result.id);
      return { schema: { hasId: !!result.id, type: result.type } };
    },
  );

  // TC-ENTITY-003: Create Entity - backlog type with quality_score object format
  const entityBacklog = await runTest(
    "TC-ENTITY-003",
    "Create Entity - backlog with quality_score object",
    async () => {
      const data = {
        type: "backlog",
        abstract: "Implement user authentication flow",
        overview: {
          text: "OAuth2 + JWT token-based auth with refresh token rotation",
          language: "en",
        },
        tags: ["feature", "auth", "P0"],
        project: PROJECT_ID,
        title: "User Authentication Flow",
        priority: "P0",
        status: "in-progress",
        quality_score: { score: 75, complexity: 8, risk_level: "medium" },
        estimated_hours: 16,
        actual_hours: 12,
        tenant_id: TENANT_ID,
      };
      const result = await client.createEntity(data);
      createdIds.entities.push(result.id);
      return { schema: { hasId: !!result.id, type: result.type } };
    },
  );

  // TC-ENTITY-004: Get Entity with level=0
  await runTest(
    "TC-ENTITY-004",
    "Get Entity with level=0 (abstract only)",
    async () => {
      if (!entityCode) throw new Error("TC-ENTITY-001 failed, no entity ID");
      const entityId = entityCode.id;
      const result = await client.getEntity(entityId, 0, TENANT_ID);
      return {
        schema: {
          hasAbstract: !!result.abstract,
          hasOverview: !!result.overview,
          hasContent: !!result.content,
        },
      };
    },
  );

  // TC-ENTITY-005: Get Entity with level=1
  await runTest(
    "TC-ENTITY-005",
    "Get Entity with level=1 (abstract + overview)",
    async () => {
      if (!entityCode) throw new Error("TC-ENTITY-001 failed, no entity ID");
      const entityId = entityCode.id;
      const result = await client.getEntity(entityId, 1, TENANT_ID);
      return {
        schema: {
          hasAbstract: !!result.abstract,
          hasOverview: !!result.overview,
          hasContent: !!result.content,
        },
      };
    },
  );

  // TC-ENTITY-006: Get Entity with level=2
  await runTest("TC-ENTITY-006", "Get Entity with level=2 (full)", async () => {
    if (!entityCode) throw new Error("TC-ENTITY-001 failed, no entity ID");
    const entityId = entityCode.id;
    const result = await client.getEntity(entityId, 2, TENANT_ID);
    return {
      schema: {
        hasAbstract: !!result.abstract,
        hasOverview: !!result.overview,
        hasContent: !!result.content,
        hasAtoms: !!result.atoms,
      },
    };
  });

  // ===== 3. Reference Tests =====
  console.log("\n--- Phase 3: Reference CRUD Tests ---");

  // TC-REF-001: Create Reference - function calls
  const refCalls = await runTest(
    "TC-REF-001",
    "Create Reference - function calls",
    async () => {
      if (!atomFunc || !atomClass) throw new Error("Atom tests failed");
      const result = await client.createReference({
        from_id: atomClass.id,
        to_id: atomFunc.id,
        type: "calls",
        weight: 0.8,
        metadata: { line: 15, column: 4, file_path: "src/services/user.ts" },
        tenant_id: TENANT_ID,
      });
      createdIds.references.push(result.id);
      return {
        schema: { hasId: !!result.id, type: result.type },
        id: result.id,
      };
    },
  );

  // TC-REF-002: Create Reference - imports
  const refImports = await runTest(
    "TC-REF-002",
    "Create Reference - imports",
    async () => {
      if (!atomFunc || !atomClass) throw new Error("Atom tests failed");
      const result = await client.createReference({
        from_id: atomFunc.id,
        to_id: atomClass.id,
        type: "imports",
        weight: 0.6,
        metadata: { line: 1, file_path: "src/utils/math.ts" },
        tenant_id: TENANT_ID,
      });
      createdIds.references.push(result.id);
      return {
        schema: { hasId: !!result.id, type: result.type },
        id: result.id,
      };
    },
  );

  // TC-REF-003: Query References
  await runTest(
    "TC-REF-003",
    "Query References by from_id and type",
    async () => {
      if (!atomClass) throw new Error("Atom tests failed");
      const result = await client.queryReferences({
        from_id: atomClass.id,
        type: "calls",
        limit: 10,
        tenant_id: TENANT_ID,
      });
      return {
        schema: {
          total: result.total,
          hasResults: result.references?.length > 0,
        },
      };
    },
  );

  // TC-REF-004: Delete Reference
  await runTest("TC-REF-004", "Delete Reference", async () => {
    if (!refImports) throw new Error("TC-REF-002 failed");
    const refId = refImports.id;
    await client.deleteReference(refId, TENANT_ID);
    // Remove from cleanup list
    const idx = createdIds.references.indexOf(refId);
    if (idx !== -1) createdIds.references.splice(idx, 1);
    return { schema: { deleted: true } };
  });

  // ===== 4. Schema Alignment Tests (BL-CA-48) =====
  console.log("\n--- Phase 4: Schema Alignment Tests (BL-CA-48) ---");

  // SCHEMA-001: Verify docstring string → object conversion
  await runTest(
    "SCHEMA-001",
    "docstring string → object conversion",
    async () => {
      // We need to intercept the actual request to verify conversion
      const origPost = client.http.post.bind(client.http);
      let capturedBody = null;
      client.http.post = async (endpoint, body) => {
        if (endpoint === "/api/v1/atoms") {
          capturedBody = body;
        }
        return origPost(endpoint, body);
      };

      const atom = await client.createAtom({
        type: "function",
        name: "schemaTest_stringDocstring",
        content: "function schemaTest() {}",
        docstring: "Plain string docstring for schema test",
        tenant_id: TENANT_ID,
      });

      client.http.post = origPost; // restore
      createdIds.atoms.push(atom.id);

      if (!capturedBody || typeof capturedBody.docstring !== "object") {
        throw new Error(
          `docstring not converted to object: ${JSON.stringify(capturedBody?.docstring)}`,
        );
      }
      if (
        capturedBody.docstring.text !== "Plain string docstring for schema test"
      ) {
        throw new Error(
          `docstring.text mismatch: ${capturedBody.docstring.text}`,
        );
      }
      return { schema: { docstringIsObject: true, hasText: true } };
    },
  );

  // SCHEMA-002: Verify docstring object format preservation
  await runTest(
    "SCHEMA-002",
    "docstring object format preservation",
    async () => {
      const origPost = client.http.post.bind(client.http);
      let capturedBody = null;
      client.http.post = async (endpoint, body) => {
        if (endpoint === "/api/v1/atoms") capturedBody = body;
        return origPost(endpoint, body);
      };

      const docObj = {
        text: "Rich docstring",
        author: "tester",
        tags: ["api", "utils"],
        version: "2.0",
      };
      const atom = await client.createAtom({
        type: "function",
        name: "schemaTest_objDocstring",
        content: "function schemaTest2() {}",
        docstring: docObj,
        tenant_id: TENANT_ID,
      });

      client.http.post = origPost;
      createdIds.atoms.push(atom.id);

      if (!capturedBody || typeof capturedBody.docstring !== "object") {
        throw new Error("docstring not an object");
      }
      if (
        capturedBody.docstring.author !== "tester" ||
        capturedBody.docstring.version !== "2.0"
      ) {
        throw new Error(
          `docstring fields lost: ${JSON.stringify(capturedBody.docstring)}`,
        );
      }
      return {
        schema: {
          preserved: true,
          author: capturedBody.docstring.author,
          version: capturedBody.docstring.version,
        },
      };
    },
  );

  // SCHEMA-003: Verify overview string → object conversion
  await runTest(
    "SCHEMA-003",
    "overview string → object conversion",
    async () => {
      const origPost = client.http.post.bind(client.http);
      let capturedBody = null;
      client.http.post = async (endpoint, body) => {
        if (endpoint === "/api/v1/entities") capturedBody = body;
        return origPost(endpoint, body);
      };

      const entity = await client.createEntity({
        type: "code",
        abstract: "Schema test entity",
        overview: "Plain string overview for schema alignment test",
        tenant_id: TENANT_ID,
      });

      client.http.post = origPost;
      createdIds.entities.push(entity.id);

      if (!capturedBody || typeof capturedBody.overview !== "object") {
        throw new Error(
          `overview not converted to object: ${JSON.stringify(capturedBody?.overview)}`,
        );
      }
      if (
        capturedBody.overview.text !==
        "Plain string overview for schema alignment test"
      ) {
        throw new Error(
          `overview.text mismatch: ${capturedBody.overview.text}`,
        );
      }
      return { schema: { overviewIsObject: true, hasText: true } };
    },
  );

  // SCHEMA-004: Verify overview object format preservation
  await runTest(
    "SCHEMA-004",
    "overview object format preservation",
    async () => {
      const origPost = client.http.post.bind(client.http);
      let capturedBody = null;
      client.http.post = async (endpoint, body) => {
        if (endpoint === "/api/v1/entities") capturedBody = body;
        return origPost(endpoint, body);
      };

      const overviewObj = {
        text: "Rich overview content",
        language: "zh-CN",
        summary: "Summary here",
      };
      const entity = await client.createEntity({
        type: "wiki",
        abstract: "Wiki entity test",
        overview: overviewObj,
        tenant_id: TENANT_ID,
      });

      client.http.post = origPost;
      createdIds.entities.push(entity.id);

      if (!capturedBody || typeof capturedBody.overview !== "object") {
        throw new Error("overview not an object");
      }
      if (
        capturedBody.overview.language !== "zh-CN" ||
        capturedBody.overview.summary !== "Summary here"
      ) {
        throw new Error(
          `overview fields lost: ${JSON.stringify(capturedBody.overview)}`,
        );
      }
      return {
        schema: {
          preserved: true,
          language: capturedBody.overview.language,
          summary: capturedBody.overview.summary,
        },
      };
    },
  );

  // SCHEMA-005: Verify quality_score number → object conversion
  await runTest(
    "SCHEMA-005",
    "quality_score number → object conversion",
    async () => {
      const origPost = client.http.post.bind(client.http);
      let capturedBody = null;
      client.http.post = async (endpoint, body) => {
        if (endpoint === "/api/v1/entities") capturedBody = body;
        return origPost(endpoint, body);
      };

      const entity = await client.createEntity({
        type: "code",
        abstract: "Quality score test",
        quality_score: 88,
        tenant_id: TENANT_ID,
      });

      client.http.post = origPost;
      createdIds.entities.push(entity.id);

      if (!capturedBody || typeof capturedBody.quality_score !== "object") {
        throw new Error(
          `quality_score not converted to object: ${JSON.stringify(capturedBody?.quality_score)}`,
        );
      }
      if (capturedBody.quality_score.score !== 88) {
        throw new Error(
          `quality_score.score mismatch: ${capturedBody.quality_score.score}`,
        );
      }
      return {
        schema: { isObject: true, score: capturedBody.quality_score.score },
      };
    },
  );

  // SCHEMA-006: Verify quality_score object format preservation
  await runTest(
    "SCHEMA-006",
    "quality_score object format preservation",
    async () => {
      const origPost = client.http.post.bind(client.http);
      let capturedBody = null;
      client.http.post = async (endpoint, body) => {
        if (endpoint === "/api/v1/entities") capturedBody = body;
        return origPost(endpoint, body);
      };

      const qsObj = {
        score: 95,
        complexity: 7,
        risk_level: "low",
        confidence: 0.92,
      };
      const entity = await client.createEntity({
        type: "code",
        abstract: "Quality score obj test",
        quality_score: qsObj,
        tenant_id: TENANT_ID,
      });

      client.http.post = origPost;
      createdIds.entities.push(entity.id);

      if (!capturedBody || typeof capturedBody.quality_score !== "object") {
        throw new Error("quality_score not an object");
      }
      if (
        capturedBody.quality_score.risk_level !== "low" ||
        capturedBody.quality_score.confidence !== 0.92
      ) {
        throw new Error(
          `quality_score fields lost: ${JSON.stringify(capturedBody.quality_score)}`,
        );
      }
      return {
        schema: {
          preserved: true,
          risk_level: capturedBody.quality_score.risk_level,
          confidence: capturedBody.quality_score.confidence,
        },
      };
    },
  );

  // ===== 5. List Operations =====
  console.log("\n--- Phase 5: List/Query Operations ---");

  await runTest("TC-LIST-001", "List Atoms by type=function", async () => {
    const result = await client.listAtoms({
      type: "function",
      limit: 5,
      tenant_id: TENANT_ID,
    });
    return {
      schema: { total: result.total, count: result.atoms?.length || 0 },
    };
  });

  await runTest("TC-LIST-002", "List Entities by type=code", async () => {
    const result = await client.listEntities({
      type: "code",
      limit: 5,
      tenant_id: TENANT_ID,
    });
    return {
      schema: { total: result.total, count: result.entities?.length || 0 },
    };
  });

  await runTest("TC-LIST-003", "List Entities by type=memory", async () => {
    const result = await client.listEntities({
      type: "memory",
      limit: 5,
      tenant_id: TENANT_ID,
    });
    return {
      schema: { total: result.total, count: result.entities?.length || 0 },
    };
  });

  // ===== Cleanup =====
  await cleanup();

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
    results.length > 0
      ? ((passed.length / results.length) * 100).toFixed(1)
      : 0;

  console.log(`\n📊 Summary:`);
  console.log(`  Total:    ${results.length}`);
  console.log(`  Passed:   ${passed.length} ✅`);
  console.log(`  Failed:   ${failed.length} ❌`);
  console.log(`  Skipped:  ${skipped.length} ⏭️`);
  console.log(`  Pass Rate: ${passRate}%`);
  console.log(`  Avg Time:  ${avgTime}ms`);
  console.log(`  Total Time: ${totalTime}ms`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    for (const f of failed) {
      console.log(`  ${f.testId}: ${f.description}`);
      console.log(`    Error: ${f.error}`);
    }
  }

  // Schema alignment summary
  const schemaTests = results.filter((r) => r.testId.startsWith("SCHEMA-"));
  const schemaPassed = schemaTests.filter((r) => r.status === "PASS");
  console.log(`\n🔍 Schema Alignment (BL-CA-48):`);
  console.log(
    `  ${schemaPassed.length}/${schemaTests.length} schema tests passed`,
  );
  const schemaOk = schemaPassed.length === schemaTests.length;
  console.log(`  Status: ${schemaOk ? "✅ ALIGNED" : "❌ MISALIGNED"}`);

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
