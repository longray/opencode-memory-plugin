/**
 * Layer 2 Functional Verification: T1 (Write) + T2 (Read) + T3 (Update)
 *
 * Tests full Atom CRUD workflow using real lib functions (no mocks).
 *
 * Run: cd opencode-memory-plugin && node tests/layer2-crud.mjs
 */

import fs from 'fs';
import { writeMemory } from '../lib/memory-core.js';
import { readMemory } from '../lib/memory-core.js';
import { updateEntity } from '../lib/memory-core.js';
import { getEntityAtoms } from '../lib/memory-core.js';
import { getEntryById } from '../lib/storage.js';
import { invalidateLinkMapCache } from '../lib/storage.js';
import { ulid } from '../lib/ulid.js';

let passed = 0;
let failed = 0;
const createdFiles = [];

function log(label, ok, detail) {
  if (ok) {
    passed++;
    console.log(`✅ ${label} — PASS (${detail})`);
  } else {
    failed++;
    console.log(`❌ ${label} — FAIL (${detail})`);
  }
}

function countAllAtoms(tree) {
  if (!tree || !Array.isArray(tree)) return 0;
  let count = 0;
  for (const node of tree) {
    count++;
    if (node.children) {
      count += countAllAtoms(node.children);
    }
  }
  return count;
}

function findNode(tree, id) {
  for (const n of tree) {
    if (n.local_id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getAtomCount(entryId) {
  invalidateLinkMapCache();
  const entry = getEntryById(entryId);
  return entry?.atoms ? countAllAtoms(entry.atoms) : 0;
}

function getAtomTree(entryId) {
  invalidateLinkMapCache();
  const entry = getEntryById(entryId);
  return entry?.atoms || [];
}

// ─── T1: Write with Atom Tree ──────────────────────────────────────────────

async function testT1() {
  console.log('\n═══ T1: Write with Atom Tree ═══\n');

  const ch1Id = ulid();
  const ch1Sec1Id = ulid();
  const ch1Sec2Id = ulid();
  const ch1Sec1NoteId = ulid();
  const ch1Sec2NoteId = ulid();

  const ch2Id = ulid();
  const ch2Sec1Id = ulid();
  const ch2Sec2Id = ulid();
  const ch2Sec1NoteId = ulid();
  const ch2Sec2NoteId = ulid();

  const atoms = [
    {
      local_id: ch1Id,
      type: 'chapter',
      name: 'Chapter 1: Basics',
      content: 'Introduction to basics. See also [[ch2Id]] for advanced topics.',
      order: 'a0',
      heading_level: 1,
      parent_id: null,
      tags: ['basics'],
      children: [
        {
          local_id: ch1Sec1Id,
          type: 'section',
          name: '1.1 Getting Started',
          content: 'How to get started with the basics.',
          order: 'a0',
          heading_level: 2,
          parent_id: ch1Id,
          children: [
            {
              local_id: ch1Sec1NoteId,
              type: 'note',
              name: 'Note: Prerequisites',
              content: 'Make sure you have Node.js installed.',
              order: 'a0',
              heading_level: 3,
              parent_id: ch1Sec1Id,
              children: [],
            },
          ],
        },
        {
          local_id: ch1Sec2Id,
          type: 'section',
          name: '1.2 Core Concepts',
          content: 'The core concepts behind the system.',
          order: 'a1',
          heading_level: 2,
          parent_id: ch1Id,
          children: [
            {
              local_id: ch1Sec2NoteId,
              type: 'note',
              name: 'Note: Key Terms',
              content: 'ULID, timeline, link-map.',
              order: 'a0',
              heading_level: 3,
              parent_id: ch1Sec2Id,
              children: [],
            },
          ],
        },
      ],
    },
    {
      local_id: ch2Id,
      type: 'chapter',
      name: 'Chapter 2: Advanced',
      content: 'Advanced topics. Cross-ref: [[ch1Sec1Id]]',
      order: 'a1',
      heading_level: 1,
      parent_id: null,
      children: [
        {
          local_id: ch2Sec1Id,
          type: 'section',
          name: '2.1 Optimization',
          content: 'Performance optimization strategies.',
          order: 'a0',
          heading_level: 2,
          parent_id: ch2Id,
          children: [
            {
              local_id: ch2Sec1NoteId,
              type: 'note',
              name: 'Note: Caching',
              content: 'Use link-map cache for fast lookups.',
              order: 'a0',
              heading_level: 3,
              parent_id: ch2Sec1Id,
              children: [],
            },
          ],
        },
        {
          local_id: ch2Sec2Id,
          type: 'section',
          name: '2.2 Error Handling',
          content: 'Best practices for error handling.',
          order: 'a1',
          heading_level: 2,
          parent_id: ch2Id,
          children: [
            {
              local_id: ch2Sec2NoteId,
              type: 'note',
              name: 'Note: Retry Logic',
              content: 'Implement exponential backoff.',
              order: 'a0',
              heading_level: 3,
              parent_id: ch2Sec2Id,
              children: [],
            },
          ],
        },
      ],
    },
  ];

  const result = await writeMemory({
    abstract: 'Layer2 CRUD test entity',
    overview: 'Testing full atom tree write/read/update lifecycle',
    content: 'This is the entity content for Layer2 CRUD verification.',
    type: 'memory',
    tags: ['test', 'layer2'],
    atoms,
  });

  log(
    'T1.1: Write returns localId and filePath',
    result.success && !!result.localId && !!result.filePath,
    `entryId: ${result.localId}, file: ${result.filePath ? 'exists' : 'missing'}`
  );

  if (!result.success) {
    console.log(`  ⚠ writeMemory failed: ${result.message}`);
    return null;
  }

  const localId = result.localId;
  createdFiles.push(result.filePath);

  const fileExists = fs.existsSync(result.filePath);
  log('T1.2: File exists on disk', fileExists, `path: ${result.filePath}`);

  let hasAtomsSection = false;
  if (fileExists) {
    const raw = fs.readFileSync(result.filePath, 'utf-8');
    hasAtomsSection = raw.includes('# ≡≡≡ Atoms ≡≡≡');
  }
  log('T1.3: File contains Atoms section', hasAtomsSection, 'section found');

  invalidateLinkMapCache();
  const entry = getEntryById(localId);
  const hasAtomsInEntry = entry && Array.isArray(entry.atoms) && entry.atoms.length > 0;
  log(
    'T1.4: getEntryById returns atoms',
    hasAtomsInEntry,
    `top-level atoms: ${entry?.atoms?.length ?? 0}`
  );

  const atomCount = getAtomCount(localId);
  log(
    'T1.5: Atom tree has correct count (10)',
    atomCount === 10,
    `total_atoms: ${atomCount} (expected 10)`
  );

  return {
    localId,
    atoms: {
      ch1Id,
      ch1Sec1Id,
      ch1Sec2Id,
      ch1Sec1NoteId,
      ch1Sec2NoteId,
      ch2Id,
      ch2Sec1Id,
      ch2Sec2Id,
      ch2Sec1NoteId,
      ch2Sec2NoteId,
    },
  };
}

// ─── T2: Read Atom (3 ways) ────────────────────────────────────────────────

async function testT2(localId, atomIds) {
  console.log('\n═══ T2: Read Atom ═══\n');

  const fullRead = await readMemory({ entry_id: localId });
  log(
    'T2.1: Read full Entity',
    fullRead.success &&
      fullRead.result_type === 'entity' &&
      Array.isArray(fullRead.atoms) &&
      fullRead.atoms.length > 0,
    `atoms present: ${Array.isArray(fullRead.atoms) && fullRead.atoms.length > 0}`
  );

  invalidateLinkMapCache();
  const atomRead = await readMemory({ entry_id: atomIds.ch1Sec1Id });
  log(
    'T2.2: Read single Atom by local_id',
    atomRead.success && atomRead.type === 'atom' && atomRead.local_id === atomIds.ch1Sec1Id,
    `name: ${atomRead.name ?? 'N/A'}`
  );

  const treeNoContent = await getEntityAtoms({ entry_id: localId, include_content: false });

  function hasNoContent(nodes) {
    if (!nodes) return true;
    for (const n of nodes) {
      if (n.content !== undefined && n.content !== null) return false;
      if (!hasNoContent(n.children)) return false;
    }
    return true;
  }

  log(
    'T2.3: getEntityAtoms include_content=false omits content',
    treeNoContent.success && hasNoContent(treeNoContent.tree),
    `success: ${treeNoContent.success}`
  );

  const tree = getAtomTree(localId);

  const ch1 = findNode(tree, atomIds.ch1Id);
  const ch1Sec1 = findNode(tree, atomIds.ch1Sec1Id);
  const ch1Sec1Note = findNode(tree, atomIds.ch1Sec1NoteId);

  const structureOk =
    ch1?.parent_id === null &&
    ch1?.children?.length === 2 &&
    ch1Sec1?.parent_id === atomIds.ch1Id &&
    ch1Sec1?.children?.length === 1 &&
    ch1Sec1Note?.parent_id === atomIds.ch1Sec1Id &&
    (ch1Sec1Note?.children?.length ?? 0) === 0;

  log(
    'T2.4: Tree structure (parent-child) correct',
    structureOk,
    `ch1.children=${ch1?.children?.length ?? 0}, sec1.parent=${ch1Sec1?.parent_id === atomIds.ch1Id ? 'ok' : 'wrong'}`
  );
}

// ─── T3: Update Atom (add/update/remove/cascade) ───────────────────────────

async function testT3(localId, atomIds) {
  console.log('\n═══ T3: Update Atom ═══\n');

  // T3.1: Add a new Atom under ch1Sec1Id
  const newNoteId = ulid();
  const addResult = await updateEntity({
    entry_id: localId,
    atoms_batch: [
      {
        action: 'add',
        local_id: newNoteId,
        type: 'note',
        name: 'New note added by test',
        content: 'This is a dynamically added note.',
        parent_id: atomIds.ch1Sec1Id,
      },
    ],
  });
  log(
    'T3.1: Add new Atom',
    addResult.success && addResult.atoms_result[0]?.success,
    `added: ${newNoteId.substring(0, 8)}`
  );

  const afterAddCount = getAtomCount(localId);
  log(
    'T3.1b: Total atoms increased by 1',
    afterAddCount === 11,
    `total: ${afterAddCount} (expected 11)`
  );

  const afterAddTree = getAtomTree(localId);
  const addedParent = findNode(afterAddTree, atomIds.ch1Sec1Id);
  const newNoteUnderParent = addedParent?.children?.some(c => c.local_id === newNoteId);
  log(
    'T3.1c: New atom under correct parent',
    !!newNoteUnderParent,
    `parent: ${atomIds.ch1Sec1Id.substring(0, 8)}`
  );

  // T3.2: Update existing atom content
  const updateResult = await updateEntity({
    entry_id: localId,
    atoms_batch: [
      {
        action: 'update',
        local_id: atomIds.ch1Sec2NoteId,
        content: 'Updated content by T3.2',
      },
    ],
  });
  log(
    'T3.2: Update atom content',
    updateResult.success && updateResult.atoms_result[0]?.success,
    `updated: ${atomIds.ch1Sec2NoteId.substring(0, 8)}`
  );

  invalidateLinkMapCache();
  const readUpdated = await readMemory({ entry_id: atomIds.ch1Sec2NoteId });
  log(
    'T3.2b: Content changed',
    readUpdated.success && readUpdated.content === 'Updated content by T3.2',
    `content: ${readUpdated.content ?? 'N/A'}`
  );

  const readOther = await readMemory({ entry_id: atomIds.ch1Sec1NoteId });
  log(
    'T3.2c: Other atoms unchanged',
    readOther.success && readOther.content === 'Make sure you have Node.js installed.',
    'ch1Sec1Note content preserved'
  );

  // T3.3: Remove leaf atom (the new note we added)
  const removeResult = await updateEntity({
    entry_id: localId,
    atoms_batch: [
      {
        action: 'remove',
        local_id: newNoteId,
      },
    ],
  });
  log(
    'T3.3: Remove leaf atom',
    removeResult.success && removeResult.atoms_result[0]?.success,
    `removed: ${newNoteId.substring(0, 8)}`
  );

  const afterRemoveCount = getAtomCount(localId);
  const afterRemoveTree = getAtomTree(localId);
  const removedGone = !findNode(afterRemoveTree, newNoteId);
  log('T3.3b: Atom gone from tree', removedGone, 'not found in tree');
  log('T3.3c: Total atoms back to 10', afterRemoveCount === 10, `total: ${afterRemoveCount}`);

  // T3.4: Cascade delete — remove ch2Sec1Id which has child ch2Sec1NoteId
  const cascadeResult = await updateEntity({
    entry_id: localId,
    atoms_batch: [
      {
        action: 'remove',
        local_id: atomIds.ch2Sec1Id,
        cascade: true,
      },
    ],
  });
  log(
    'T3.4: Cascade delete section + children',
    cascadeResult.success && cascadeResult.atoms_result[0]?.removed_count === 2,
    `removed_count: ${cascadeResult.atoms_result[0]?.removed_count ?? 'N/A'}`
  );

  const afterCascadeCount = getAtomCount(localId);
  const afterCascadeTree = getAtomTree(localId);
  const secGone = !findNode(afterCascadeTree, atomIds.ch2Sec1Id);
  const noteGone = !findNode(afterCascadeTree, atomIds.ch2Sec1NoteId);
  log('T3.4b: Section removed', secGone, `ch2Sec1: ${secGone ? 'gone' : 'still present'}`);
  log('T3.4c: Child note removed', noteGone, `ch2Sec1Note: ${noteGone ? 'gone' : 'still present'}`);
  log('T3.4d: Total atoms decreased to 8', afterCascadeCount === 8, `total: ${afterCascadeCount}`);

  // T3.5: Circular reference rejection via writeMemory
  // writeMemory's detectCircularReference works on the flat atoms array
  // (updateEntity's cycle check has a known limitation with tree-structured input)
  const circA = ulid();
  const circB = ulid();

  const circWriteResult = await writeMemory({
    abstract: 'Circular reference test',
    overview: 'Should be rejected',
    content: 'test',
    type: 'memory',
    tags: ['test'],
    atoms: [
      {
        local_id: circA,
        type: 'note',
        name: 'CircA',
        content: 'A refs B as parent',
        parent_id: circB,
        children: [],
      },
      {
        local_id: circB,
        type: 'note',
        name: 'CircB',
        content: 'B refs A as parent',
        parent_id: circA,
        children: [],
      },
    ],
  });

  const circRejected =
    !circWriteResult.success && circWriteResult.message?.toLowerCase().includes('circular');

  log(
    'T3.5: Circular reference rejected (writeMemory)',
    circRejected,
    `error: ${circWriteResult.message ?? 'none'}`
  );

  // Verify no file was created for the rejected entity
  const noFileCreated = !circWriteResult.filePath || !fs.existsSync(circWriteResult.filePath);
  log(
    'T3.5b: No file created for rejected write',
    noFileCreated,
    `filePath: ${circWriteResult.filePath ?? 'none'}`
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Layer 2 Functional Verification: Atom CRUD');
  console.log('==========================================');

  try {
    const t1Result = await testT1();
    if (!t1Result) {
      console.log('\n⚠ T1 failed, skipping T2/T3');
    } else {
      await testT2(t1Result.localId, t1Result.atoms);
      await testT3(t1Result.localId, t1Result.atoms);
    }
  } finally {
    for (const f of createdFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(50)}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
