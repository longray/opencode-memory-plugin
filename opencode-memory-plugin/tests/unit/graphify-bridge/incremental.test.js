import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  nodeHash,
  diffGraphs,
  loadCache,
  saveCache,
  importGraphJSONIncremental,
} from '../../../lib/graphify-bridge.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OLD_GRAPH = {
  directed: true,
  nodes: [
    { id: 'file_a_js', label: 'a.js', file_type: 'code', source_file: 'a.js', source_location: '', community: 1 },
    { id: 'file_a_js_foo', label: 'foo()', file_type: 'code', source_file: 'a.js', source_location: 'L10', community: 1 },
    { id: 'file_a_js_bar', label: 'bar()', file_type: 'code', source_file: 'a.js', source_location: 'L20', community: 1 },
    { id: 'file_b_js', label: 'b.js', file_type: 'code', source_file: 'b.js', source_location: '', community: 2 },
    { id: 'file_b_js_baz', label: 'baz()', file_type: 'code', source_file: 'b.js', source_location: 'L5', community: 2 },
  ],
  links: [
    { source: 'file_a_js', target: 'file_a_js_foo', relation: 'contains', confidence: 'EXTRACTED', confidence_score: 1.0 },
    { source: 'file_a_js', target: 'file_a_js_bar', relation: 'contains', confidence: 'EXTRACTED', confidence_score: 1.0 },
    { source: 'file_a_js_bar', target: 'file_a_js_foo', relation: 'calls', confidence: 'INFERRED', confidence_score: 0.8 },
    { source: 'file_b_js', target: 'file_b_js_baz', relation: 'contains', confidence: 'EXTRACTED', confidence_score: 1.0 },
  ],
};

describe('nodeHash', () => {
  it('should produce deterministic hash for same node', () => {
    const node = { label: 'foo()', source_file: 'a.js', source_location: 'L10', file_type: 'code' };
    expect(nodeHash(node)).toBe(nodeHash(node));
  });

  it('should differ for different source_location', () => {
    const a = { label: 'foo()', source_file: 'a.js', source_location: 'L10', file_type: 'code' };
    const b = { label: 'foo()', source_file: 'a.js', source_location: 'L15', file_type: 'code' };
    expect(nodeHash(a)).not.toBe(nodeHash(b));
  });

  it('should differ for different label', () => {
    const a = { label: 'foo()', source_file: 'a.js', source_location: 'L10', file_type: 'code' };
    const b = { label: 'bar()', source_file: 'a.js', source_location: 'L10', file_type: 'code' };
    expect(nodeHash(a)).not.toBe(nodeHash(b));
  });

  it('should handle missing fields gracefully', () => {
    const node = { label: 'test', source_file: 'x.js' };
    expect(typeof nodeHash(node)).toBe('string');
    expect(nodeHash(node)).toHaveLength(16);
  });
});

describe('diffGraphs', () => {
  it('should detect added nodes', () => {
    const newGraph = {
      nodes: [...OLD_GRAPH.nodes, { id: 'file_c_js', label: 'c.js', file_type: 'code', source_file: 'c.js', source_location: '' }],
      links: [...OLD_GRAPH.links],
    };
    const diff = diffGraphs(OLD_GRAPH, newGraph);
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.addedNodes[0].id).toBe('file_c_js');
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.changedNodes).toHaveLength(0);
  });

  it('should detect removed nodes', () => {
    const newGraph = {
      nodes: OLD_GRAPH.nodes.filter(n => n.id !== 'file_b_js' && n.id !== 'file_b_js_baz'),
      links: OLD_GRAPH.links.filter(l => l.source !== 'file_b_js' && l.target !== 'file_b_js_baz'),
    };
    const diff = diffGraphs(OLD_GRAPH, newGraph);
    expect(diff.removedNodes).toHaveLength(2);
    expect(diff.addedNodes).toHaveLength(0);
  });

  it('should detect changed nodes (different source_location)', () => {
    const newNodes = OLD_GRAPH.nodes.map(n =>
      n.id === 'file_a_js_foo' ? { ...n, source_location: 'L15' } : n
    );
    const newGraph = { nodes: newNodes, links: [...OLD_GRAPH.links] };
    const diff = diffGraphs(OLD_GRAPH, newGraph);
    expect(diff.changedNodes).toHaveLength(1);
    expect(diff.changedNodes[0].old.source_location).toBe('L10');
    expect(diff.changedNodes[0].new.source_location).toBe('L15');
  });

  it('should not report unchanged nodes', () => {
    const newGraph = { nodes: [...OLD_GRAPH.nodes], links: [...OLD_GRAPH.links] };
    const diff = diffGraphs(OLD_GRAPH, newGraph);
    expect(diff.addedNodes).toHaveLength(0);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.changedNodes).toHaveLength(0);
  });

  it('should detect added and removed links', () => {
    const newLinks = [
      ...OLD_GRAPH.links.filter(l => l.relation !== 'calls'),
      { source: 'file_a_js_foo', target: 'file_b_js_baz', relation: 'imports', confidence: 'EXTRACTED', confidence_score: 1.0 },
    ];
    const newGraph = { nodes: [...OLD_GRAPH.nodes], links: newLinks };
    const diff = diffGraphs(OLD_GRAPH, newGraph);
    expect(diff.addedLinks).toHaveLength(1);
    expect(diff.removedLinks).toHaveLength(1);
  });

  it('should identify remappable links for changed nodes', () => {
    const newNodes = OLD_GRAPH.nodes.map(n =>
      n.id === 'file_a_js_bar' ? { ...n, source_location: 'L25' } : n
    );
    const newGraph = { nodes: newNodes, links: [...OLD_GRAPH.links] };
    const diff = diffGraphs(OLD_GRAPH, newGraph);
    expect(diff.changedNodes).toHaveLength(1);
    expect(diff.remappableLinks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('loadCache / saveCache', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-cache-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null when no cache exists', async () => {
    const result = await loadCache(path.join(tmpDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('should save and load cache correctly', async () => {
    const cachePath = path.join(tmpDir, 'cache.json');
    const graph = {
      nodes: [{ id: 'test', label: 'test.js', source_file: 'test.js', source_location: '', file_type: 'code' }],
      links: [],
    };
    const maps = {
      entityMap: new Map([['test', 'backend:123']]),
      atomMap: new Map(),
    };
    await saveCache(cachePath, graph, maps);
    const loaded = await loadCache(cachePath);
    expect(loaded).not.toBeNull();
    expect(loaded.nodes).toHaveLength(1);
    expect(loaded.nodes[0]._hash).toBeDefined();
    expect(loaded.backendMaps.entityMap.test).toBe('backend:123');
  });

  it('should fallback to null on corrupted cache', async () => {
    const cachePath = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(cachePath, 'not valid json {{{');
    const result = await loadCache(cachePath);
    expect(result).toBeNull();
  });
});

describe('importGraphJSONIncremental', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-incr-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeGraph(graph) {
    const outDir = path.join(tmpDir, 'graphify-out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'graph.json'), JSON.stringify(graph));
  }

  function writeCache(graph, backendMaps = {}) {
    const outDir = path.join(tmpDir, 'graphify-out');
    fs.mkdirSync(outDir, { recursive: true });
    const cache = {
      version: 1,
      timestamp: new Date().toISOString(),
      nodes: graph.nodes.map(n => ({ ...n, _hash: nodeHash(n) })),
      links: graph.links,
      backendMaps: {
        entityMap: backendMaps.entityMap || {},
        atomMap: backendMaps.atomMap || {},
      },
    };
    fs.writeFileSync(path.join(outDir, '.graphify-cache.json'), JSON.stringify(cache));
  }

  function createMockClient() {
    const calls = {
      deleteByProject: [],
      batchCreateEntities: [],
      batchCreateAtoms: [],
      createReferences: [],
      createReference: [],
      httpDelete: [],
      httpGet: [],
    };
    return {
      calls,
      deleteByProject: async (...args) => {
        calls.deleteByProject.push(args);
        return { deleted: 0 };
      },
      batchCreateEntities: async (batch) => {
        calls.batchCreateEntities.push(batch);
        return {
          entities: batch.map((b, i) => ({ id: `entity:ent${calls.batchCreateEntities.length}_${i}`, file_path: b.file_path })),
          created: batch.length,
        };
      },
      batchCreateAtoms: async (batch) => {
        calls.batchCreateAtoms.push(batch);
        return {
          atoms: batch.map((_, i) => ({ id: `atom:at${calls.batchCreateAtoms.length}_${i}` })),
          created: batch.length,
        };
      },
      createReferences: async (batch) => {
        calls.createReferences.push(batch);
        const refs = batch.map(() => ({ id: `reference:ref${Date.now()}`, status: 'created' }));
        return { references: refs, created: refs.length, errors: 0 };
      },
      createReference: async (payload) => {
        calls.createReference.push(payload);
        return { id: 'reference:ref1' };
      },
      http: {
        delete: async (url) => {
          calls.httpDelete.push(url);
          return { success: true };
        },
        get: async (url) => {
          calls.httpGet.push(url);
          return { atoms: [], data: [] };
        },
      },
    };
  }

  it('should fall back to full import when no cache exists', async () => {
    writeGraph(OLD_GRAPH);
    const client = createMockClient();

    const result = await importGraphJSONIncremental({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.mode).toBe('full');
    expect(client.calls.deleteByProject).toHaveLength(1);
  });

  it('should skip import when no changes detected', async () => {
    writeGraph(OLD_GRAPH);
    writeCache(OLD_GRAPH, {
      entityMap: { file_a_js: 'e1', file_b_js: 'e2' },
      atomMap: { file_a_js_foo: 'a1', file_a_js_bar: 'a2', file_b_js_baz: 'a3' },
    });
    const client = createMockClient();

    const result = await importGraphJSONIncremental({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.mode).toBe('incremental');
    expect(result.entities).toBe(0);
    expect(result.atoms).toBe(0);
    expect(result.references).toBe(0);
  });

  it('should import added nodes incrementally', async () => {
    const newGraph = {
      nodes: [...OLD_GRAPH.nodes, { id: 'file_c_js', label: 'c.js', file_type: 'code', source_file: 'c.js', source_location: '', community: 3 }],
      links: [...OLD_GRAPH.links],
    };
    writeGraph(newGraph);
    writeCache(OLD_GRAPH, {
      entityMap: { file_a_js: 'e1', file_b_js: 'e2' },
      atomMap: { file_a_js_foo: 'a1', file_a_js_bar: 'a2', file_b_js_baz: 'a3' },
    });
    const client = createMockClient();

    const result = await importGraphJSONIncremental({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.mode).toBe('incremental');
    expect(result.entities).toBeGreaterThanOrEqual(1);
  });

  it('should handle cache corruption by falling back to full import', async () => {
    writeGraph(OLD_GRAPH);
    const outDir = path.join(tmpDir, 'graphify-out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, '.graphify-cache.json'), 'corrupted{{{');

    const client = createMockClient();
    const result = await importGraphJSONIncremental({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    expect(result.mode).toBe('full');
  });

  it('should save cache after successful import', async () => {
    writeGraph(OLD_GRAPH);
    const client = createMockClient();

    await importGraphJSONIncremental({
      projectPath: tmpDir,
      projectId: 'test-project',
      client,
      tenantId: 'longray',
    });

    const cachePath = path.join(tmpDir, 'graphify-out', '.graphify-cache.json');
    expect(fs.existsSync(cachePath)).toBe(true);
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    expect(cache.version).toBe(1);
    expect(cache.nodes.length).toBeGreaterThan(0);
  });
});
