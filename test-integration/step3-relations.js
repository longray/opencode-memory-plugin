import { WrapperClient } from "../opencode-memory-plugin/lib/wrapper-client.js";

const wrapperClient = new WrapperClient();

const cryptoMemoryId = "memory:ihvclhn43qeqkg3f3twt";
const authMemoryId = "memory:rdm1dtmxs23ca2f5vqv6";

console.log("=== Step 5: Create memory relations ===");
console.log("Using /api/v1/memories/relations endpoint");

const relations = [
  {
    from_id: authMemoryId,
    to_id: cryptoMemoryId,
    relationship_type: "reference",
    description: "auth.register calls crypto.hashPassword (line 6)",
  },
  {
    from_id: authMemoryId,
    to_id: cryptoMemoryId,
    relationship_type: "reference",
    description: "auth.validateUser calls crypto.verifyPassword (line 12)",
  },
  {
    from_id: authMemoryId,
    to_id: cryptoMemoryId,
    relationship_type: "reference",
    description: "auth.login calls crypto.generateToken (line 21)",
  },
];

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < relations.length; i++) {
  const rel = relations[i];
  console.log(`\nCreating relation ${i + 1}/${relations.length}:`);
  console.log(`  ${rel.from_id} -> ${rel.to_id}`);
  console.log(`  Type: ${rel.relationship_type}`);

  try {
    const result = await wrapperClient.http.post("/api/v1/memories/relations", {
      from_id: rel.from_id,
      to_id: rel.to_id,
      relationship_type: rel.relationship_type,
      description: rel.description,
      tenant_id: "default",
    });

    console.log("  ✅ Created:", result.id);
    successCount++;
  } catch (error) {
    console.error("  ❌ Failed:", error.message);
    errorCount++;
  }
}

console.log("\n=== Summary ===");
console.log(`Success: ${successCount}/${relations.length}`);
console.log(`Failed: ${errorCount}/${relations.length}`);

if (successCount === relations.length) {
  console.log("\n✅ All relations created successfully!");
} else {
  console.log("\n⚠️ Some relations failed");
}
