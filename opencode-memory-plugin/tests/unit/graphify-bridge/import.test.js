import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { importGraphJSON } from '../../../lib/graphify-bridge.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SAMPLE_GRAPH = {
  directed: true,
  nodes: [
    {
      id: 'lib_test_js',
      label: 'test.js',
      file_type: 'code',
      source_file: 'lib/test.js',
      source_location: '',
      community: 1,
      norm_label: 'test.js',
    },
    {
      id: 'lib_test_js_foo',
      label: 'foo()',
      file_type: 'code',
      source_file: 'lib/test.js',
      source_location: 'L10',
      community: 1,
      norm_label: 'foo()',
    },
    {
      id: 'lib_test_js_bar',
      label: 'Bar',
      file_type: 'code',
      source_file: 'lib/test.js',
      source_location: 'L20',
      community: 1,
      norm_label: 'bar',
    },
  ],
  links: [
    {
      source: 'lib_test_js',
      target: 'lib_test_js_foo',
      relation: 'contains',
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      weight: 1,
    },
    {
      source: 'lib_test_js',
      target: 'lib_test_js_bar',
      relation: 'contains',
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      weight: 1,
    },
    {
      source: 'lib_test_js_bar',
      target: 'lib_test_js_foo',
      relation: 'method',
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      weight: 1,
    },
    {
      source: 'lib_test_js_foo',
      target: 'lib_test_js_bar',
      relation: 'calls',
      confidence: 'INFERRED',
      confidence_score: 0.8,
      weight: 1,
    },
  ],
};

function createMockClient() {
  const calls = {
    deleteByProject: [],
    batchCreateEntities: [],
    batchCreateAtoms: [],
    createAtom: [],
    createReferences: [],
    createReference: [],
  };
  let _atomCounter = 0;
  return {
    calls,
    deleteByProject: async (...args) => {
      calls.deleteByProject.push(args);
      return { deleted: 0 };
    },
    batchCreateEntities: async (...args) => {
      calls.batchCreateEntities.push(args);
      return {
        entities: [{ id: 'entity:ent1', file_path: 'lib/test.js' }],
        created: 1,
        skipped: 0,
        errors: 0,
      };
    },
    batchCreateAtoms: async (...args) => {
      calls.batchCreateAtoms.push(args);
      const atoms = args[0].map(() => {
        _atomCounter++;
        return { id: `atom:at${_atomCounter}` };
      });
      return { created: atoms.length, skipped: 0, errors: 0, atoms };
    },
    createAtom: async (...args) => {
      calls.createAtom.push(args);
      _atomCounter++;
      return { id: `atom:at${_atomCounter}` };
    },
    createReferences: async (...args) => {
      calls.createReferences.push(args);
      const refs = args[0].map(() => ({
        id: `reference:ref${calls.createReferences.length}`,
        status: 'created',
      }));
      return { references: refs, created: refs.length, errors: 0 };
    },
    createReference: async (...args) => {
      calls.createReference.push(args);
      return { id: 'reference:ref1' };
    },
  };
}

let tmpDir;

function writeGraphFile(graph) {
  const outDir = path.join(tmpDir, 'graphify-out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'graph.json'), JSON.stringify(graph));
}

describe('importGraphJSON', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should import full graph with correct counts', async () => {
    writeGraphFile(SAMPLE_GRAPH);
    const client = createMockClient();

    const result = await importGraphJSON({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.entities).toBe(1);
    expect(result.atoms).toBe(2);
    expect(result.references).toBe(4);
    expect(client.calls.deleteByProject).toEqual([['test-project', 'longray']]);
    expect(client.calls.batchCreateEntities).toHaveLength(1);
    expect(client.calls.batchCreateAtoms.length).toBeGreaterThanOrEqual(1);
    expect(client.calls.createReferences).toHaveLength(1);
    expect(client.calls.createReference).toHaveLength(0);
  });

  it('should skip links with unresolvable IDs', async () => {
    const graph = {
      directed: true,
      nodes: [
        {
          id: 'a',
          label: 'a.js',
          file_type: 'code',
          source_file: 'a.js',
          source_location: '',
          community: 1,
          norm_label: 'a.js',
        },
      ],
      links: [
        {
          source: 'a',
          target: 'nonexistent',
          relation: 'calls',
          confidence: 'EXTRACTED',
          confidence_score: 1.0,
          weight: 1,
        },
      ],
    };

    writeGraphFile(graph);
    const client = createMockClient();

    const result = await importGraphJSON({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.references).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should report errors from failed reference creation', async () => {
    writeGraphFile(SAMPLE_GRAPH);
    const client = {
      ...createMockClient(),
      createReferences: async batch => {
        const refs = batch.map((_, i) => ({
          id: i === 0 ? 'reference:err' : `reference:ref${i}`,
          status: i === 0 ? 'error' : 'created',
        }));
        const errorCount = refs.filter(r => r.status === 'error').length;
        return { references: refs, created: refs.length - errorCount, errors: errorCount };
      },
    };

    const result = await importGraphJSON({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.errors).toBeGreaterThanOrEqual(1);
  });

  it('should count relations by type', async () => {
    writeGraphFile(SAMPLE_GRAPH);
    const client = createMockClient();

    const result = await importGraphJSON({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.byRelation).toEqual({
      contains: 2,
      method: 1,
      calls: 1,
    });
  });
});
