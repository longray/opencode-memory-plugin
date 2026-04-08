import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const cryptoMemoryId = "memory:ihvclhn43qeqkg3f3twt";
const authMemoryId = "memory:rdm1dtmxs23ca2f5vqv6";

console.log("=== Step 6: Query references (who calls crypto.ts) ===");
console.log("Querying:", cryptoMemoryId);

try {
  const result = await wrapperClient.http.post(
    `/api/v1/memories/${cryptoMemoryId}/relations`,
    {
      direction: "incoming",
      tenant_id: "default",
    },
  );

  console.log("\nReferences result:");
  console.log("- Total:", result.total);
  console.log("- Relations:", result.relations.length);

  if (result.relations.length > 0) {
    result.relations.forEach((rel, i) => {
      console.log(`\n  ${i + 1}. From: ${rel.from_id}`);
      console.log(`     Type: ${rel.relationship_type}`);
      console.log(`     Description: ${rel.description}`);
    });
    console.log("\n✅ References query successful!");
  } else {
    console.log("\n⚠️ No references found");
  }
} catch (error) {
  console.error("\n❌ Query failed:", error.message);
}

console.log("\n=== Step 7: Query dependencies (what auth.ts calls) ===");
console.log("Querying:", authMemoryId);

try {
  const result = await wrapperClient.http.post(
    `/api/v1/memories/${authMemoryId}/relations`,
    {
      direction: "outgoing",
      tenant_id: "default",
    },
  );

  console.log("\nDependencies result:");
  console.log("- Total:", result.total);
  console.log("- Relations:", result.relations.length);

  if (result.relations.length > 0) {
    result.relations.forEach((rel, i) => {
      console.log(`\n  ${i + 1}. To: ${rel.to_id}`);
      console.log(`     Type: ${rel.relationship_type}`);
      console.log(`     Description: ${rel.description}`);
    });
    console.log("\n✅ Dependencies query successful!");
  } else {
    console.log("\n⚠️ No dependencies found");
  }
} catch (error) {
  console.error("\n❌ Query failed:", error.message);
}
