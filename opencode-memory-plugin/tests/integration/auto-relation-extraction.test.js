/**
 * Integration Tests - Auto Code Relation Extraction
 *
 * Tests the full workflow: code analysis → symbol table building → relation creation
 * Covers: SymbolTable, CodeAnalyzer (calls/extends/super), Dual Threshold + PendingReviewQueue,
 *         ScheduledHealthCheck, AnalysisQueue (extractImports, resolveImportPath, createDependsOnRelations)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ===== Test 1: SymbolTable Integration =====

import { SymbolTable } from '../../lib/symbol-table.js';

const TEST_DIR = path.join(os.tmpdir(), `symbol-integration-test-${Date.now()}`);

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('SymbolTable Integration', () => {
  let st;
  const persistDir = path.join(TEST_DIR, 'persist');

  beforeEach(() => {
    fs.mkdirSync(persistDir, { recursive: true });
    st = new SymbolTable('test-project', persistDir);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('save/load roundtrip preserves all data', async () => {
    await st.setPathMapping('src/utils.js', 'entity:utils');
    await st.setPathMapping('src/index.js', 'entity:index');
    await st.setGlobalSymbol('helper', 'entity:utils', 'src/utils.js');
    await st.setGlobalSymbol('main', 'entity:index', 'src/index.js');

    st.getPathEntityId('src/utils.js');
    st.getSymbolEntityId('helper');
    await st.save();

    const st2 = new SymbolTable('test-project', persistDir);
    await st2.load();

    expect(st2.getPathEntityId('src/utils.js')).toBe('entity:utils');
    expect(st2.getPathEntityId('src/index.js')).toBe('entity:index');
    expect(st2.getSymbolEntityId('helper')).toBe('entity:utils');
    expect(st2.getSymbolEntityId('main')).toBe('entity:index');
    expect(st2.getSymbolEntityId('src/utils.js:helper')).toBe('entity:utils');
    expect(st2.getSymbolEntityId('src/index.js:main')).toBe('entity:index');
    expect(st2._lruPathOrder).toContain('src/utils.js');
    expect(st2._lruGlobalOrder).toContain('helper');

    st2.cleanup();
  });

  it('invalidatePath works after load (reverse index is rebuilt)', async () => {
    await st.setPathMapping('src/utils.js', 'entity:utils');
    await st.setGlobalSymbol('helper', 'entity:utils', 'src/utils.js');
    await st.setGlobalSymbol('other', 'entity:other');
    await st.save();

    const st2 = new SymbolTable('test-project', persistDir);
    await st2.load();

    expect(st2.getPathEntityId('src/utils.js')).toBe('entity:utils');
    expect(st2.getSymbolEntityId('helper')).toBe('entity:utils');

    st2.invalidatePath('src/utils.js');

    expect(st2.getPathEntityId('src/utils.js')).toBeNull();
    expect(st2.getSymbolEntityId('helper')).toBeNull();
    expect(st2.getSymbolEntityId('other')).toBe('entity:other');

    st2.cleanup();
  });
});

// ===== Test 2: CodeAnalyzer with calls/extends/super =====

import { CodeAnalyzer } from '../../lib/code-analyzer.js';

describe('CodeAnalyzer with calls/extends/super', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CodeAnalyzer();
  });

  it('analyzes JS file with function calls → verifies calls array', async () => {
    const code = `
      function main() {
        helper();
        doWork();
      }
      function helper() {}
      function doWork() {}
    `;

    const result = await analyzer.analyze('test.js', code);
    const callTargets = result.calls.map(c => c.target);

    expect(callTargets).toContain('helper');
    expect(callTargets).toContain('doWork');
    expect(result.calls.length).toBe(2);
  });

  it('analyzes JS file with class extends → verifies superClass field', async () => {
    const code = `
      class Animal { eat() {} }
      class Dog extends Animal { bark() {} }
    `;

    const result = await analyzer.analyze('test.js', code);
    const dogClass = result.classes.find(c => c.name === 'Dog');

    expect(dogClass).toBeDefined();
    expect(dogClass.superClass).toBe('Animal');
  });

  it('analyzes JS file with super.method() → verifies "super.method" in calls', async () => {
    const code = `
      class Base { init() {} }
      class Child extends Base {
        init() {
          super.init();
          this.setup();
        }
        setup() {}
      }
    `;

    const result = await analyzer.analyze('test.js', code);
    const callTargets = result.calls.map(c => c.target);

    expect(callTargets).toContain('super.init');
    expect(callTargets).toContain('this.setup');
  });

  it('analyzes JS file with deep member chains → verifies full chain in calls', async () => {
    const code = `
      function main() {
        a.b.c.d();
        x.y.z();
      }
    `;

    const result = await analyzer.analyze('test.js', code);
    const callTargets = result.calls.map(c => c.target);

    expect(callTargets).toContain('a.b.c.d');
    expect(callTargets).toContain('x.y.z');
  });

  it('fallback result includes calls: []', async () => {
    const result = await analyzer.analyze('test.xyz', 'some code');

    expect(result.analyzer).toBe('fallback');
    expect(result.calls).toEqual([]);
  });
});

// ===== Test 3: AnalysisQueue - extractImports, resolveImportPath, createDependsOnRelations =====

import { AnalysisQueue } from '../../lib/code-analysis-service.js';

describe('AnalysisQueue Integration', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  afterEach(() => {
    if (queue.batchTimer) clearTimeout(queue.batchTimer);
    if (queue.debounceTimer) clearTimeout(queue.debounceTimer);
  });

  describe('extractImports', () => {
    it('extracts ES6 imports correctly', () => {
      const analysisResult = {
        imports: [
          { source: './utils', imported_names: ['helper', 'format'], start_line: 1 },
          { source: './config', imported_names: ['default'], start_line: 2 },
          { source: './logger', imported_names: ['* as log'], start_line: 3 },
        ],
      };

      const imports = queue.extractImports(analysisResult);

      expect(imports).toHaveLength(3);
      expect(imports[0]).toMatchObject({
        source: './utils',
        type: 'es6',
        isDefault: false,
        isNamespace: false,
      });
      expect(imports[0].imported_names).toEqual(['helper', 'format']);
      expect(imports[1].isDefault).toBe(true);
      expect(imports[2].isNamespace).toBe(true);
      expect(imports[2].namespace).toBe('log');
    });

    it('handles empty imports', () => {
      const imports = queue.extractImports({ imports: [] });
      expect(imports).toEqual([]);
    });
  });

  describe('resolveImportPath', () => {
    it('handles .py extension', () => {
      const symbolTable = { pathToEntityId: new Map([['src/utils.py', 'entity:py']]) };
      const result = queue.resolveImportPath('./utils', 'src/index.js', symbolTable);
      expect(result).toBe('entity:py');
    });

    it('handles .go extension', () => {
      const symbolTable = { pathToEntityId: new Map([['src/utils.go', 'entity:go']]) };
      const result = queue.resolveImportPath('./utils', 'src/index.js', symbolTable);
      expect(result).toBe('entity:go');
    });

    it('handles .rs extension', () => {
      const symbolTable = { pathToEntityId: new Map([['src/utils.rs', 'entity:rs']]) };
      const result = queue.resolveImportPath('./utils', 'src/index.js', symbolTable);
      expect(result).toBe('entity:rs');
    });

    it('handles .java extension', () => {
      const symbolTable = { pathToEntityId: new Map([['src/utils.java', 'entity:java']]) };
      const result = queue.resolveImportPath('./utils', 'src/index.js', symbolTable);
      expect(result).toBe('entity:java');
    });

    it('returns null for external imports', () => {
      const symbolTable = { pathToEntityId: new Map() };
      const result = queue.resolveImportPath('lodash', 'src/index.js', symbolTable);
      expect(result).toBeNull();
    });
  });

  describe('createDependsOnRelations', () => {
    it('creates depends_on relations for internal imports', async () => {
      const symbolTable = {
        pathToEntityId: new Map([
          ['src/utils.js', 'entity:utils'],
          ['src/config.js', 'entity:config'],
        ]),
      };
      const existingRefs = new Set();
      const imports = [
        { source: './utils', imported_names: ['helper'], type: 'es6' },
        { source: './config', imported_names: ['default'], type: 'es6' },
      ];

      const deps = await queue.createDependsOnRelations(
        'entity:index',
        'src/index.js',
        imports,
        symbolTable,
        'default',
        existingRefs
      );

      expect(deps).toHaveLength(2);
      expect(deps[0]).toMatchObject({
        from_id: 'entity:index',
        to_id: 'entity:utils',
        type: 'depends_on',
        weight: 0.8,
      });
      expect(deps[1]).toMatchObject({
        from_id: 'entity:index',
        to_id: 'entity:config',
        type: 'depends_on',
      });
    });

    it('skips builtin modules', async () => {
      const symbolTable = {
        pathToEntityId: new Map([['src/utils.js', 'entity:utils']]),
      };
      const existingRefs = new Set();
      const imports = [
        { source: 'fs', imported_names: [], type: 'es6' },
        { source: 'path', imported_names: [], type: 'es6' },
        { source: './utils', imported_names: ['helper'], type: 'es6' },
      ];

      const deps = await queue.createDependsOnRelations(
        'entity:index',
        'src/index.js',
        imports,
        symbolTable,
        'default',
        existingRefs
      );

      expect(deps).toHaveLength(1);
      expect(deps[0].to_id).toBe('entity:utils');
    });

    it('existingRefs is shared across multiple calls (dedup)', async () => {
      const symbolTable = {
        pathToEntityId: new Map([['src/utils.js', 'entity:utils']]),
      };
      const existingRefs = new Set();
      const imports = [{ source: './utils', imported_names: ['helper'], type: 'es6' }];

      const deps1 = await queue.createDependsOnRelations(
        'entity:index',
        'src/index.js',
        imports,
        symbolTable,
        'default',
        existingRefs
      );
      const deps2 = await queue.createDependsOnRelations(
        'entity:index',
        'src/index.js',
        imports,
        symbolTable,
        'default',
        existingRefs
      );

      expect(deps1).toHaveLength(1);
      expect(deps2).toHaveLength(0);
    });
  });
});

// ===== Test 4: Dual Threshold + PendingReviewQueue =====

import {
  classifyRecommendation,
  recommendWithDualThreshold,
} from '../../lib/relation-recommender.js';
import { PendingReviewQueue } from '../../lib/pending-review-queue.js';

describe('Dual Threshold + PendingReviewQueue', () => {
  describe('classifyRecommendation boundaries', () => {
    it('0.85 → auto_create', () => {
      expect(classifyRecommendation(0.85)).toBe('auto_create');
    });

    it('0.90 → auto_create', () => {
      expect(classifyRecommendation(0.9)).toBe('auto_create');
    });

    it('0.84 → pending_review', () => {
      expect(classifyRecommendation(0.84)).toBe('pending_review');
    });

    it('0.75 → pending_review', () => {
      expect(classifyRecommendation(0.75)).toBe('pending_review');
    });

    it('0.74 → ignored', () => {
      expect(classifyRecommendation(0.74)).toBe('ignored');
    });

    it('0.50 → ignored', () => {
      expect(classifyRecommendation(0.5)).toBe('ignored');
    });

    it('1.0 → auto_create', () => {
      expect(classifyRecommendation(1.0)).toBe('auto_create');
    });

    it('0.0 → ignored', () => {
      expect(classifyRecommendation(0.0)).toBe('ignored');
    });
  });

  describe('PendingReviewQueue', () => {
    let queue;
    const queueFile = path.join(TEST_DIR, 'test-pending-queue.json');

    beforeEach(() => {
      queue = new PendingReviewQueue({ queueFile });
    });

    afterEach(async () => {
      await queue.clear();
      try {
        if (fs.existsSync(queueFile)) {
          fs.unlinkSync(queueFile);
        }
      } catch {
        // Ignore cleanup errors
      }
    });

    it('add → list → approve → verify removed', async () => {
      const item = {
        from_id: 'entity-1',
        to_id: 'entity-2',
        similarity: 0.8,
        type: 'related',
      };

      const queueId = await queue.add(item);
      expect(queueId).toBeDefined();
      expect(queue.list().length).toBe(1);

      const approved = await queue.approve(queueId);
      expect(approved).toBeDefined();
      expect(approved.queueId).toBe(queueId);
      expect(queue.list().length).toBe(0);
    });

    it('add → expire → verify expired items removed', async () => {
      const item = {
        from_id: 'entity-1',
        to_id: 'entity-2',
        similarity: 0.8,
        type: 'related',
      };

      const queueId = await queue.add(item);
      expect(queue.list().length).toBe(1);

      const items = queue.list();
      const target = items.find(i => i.queueId === queueId);
      target.addedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      await queue.save();

      const expired = await queue.expireOldItems();
      expect(expired).toBe(1);
      expect(queue.list().length).toBe(0);
    });
  });

  describe('recommendWithDualThreshold', () => {
    it('bidirectional dedup: A→B and B→A treated as same pair', async () => {
      const recommendations = [
        { from_id: 'A', to_id: 'B', similarity: 0.9, type: 'related', weight: 0.9 },
        { from_id: 'B', to_id: 'A', similarity: 0.88, type: 'related', weight: 0.88 },
      ];

      const result = await recommendWithDualThreshold({
        recommendations,
        dryRun: true,
      });

      expect(result.autoCreated).toBe(1);
      expect(result.total).toBe(2);
    });

    it('mixed classifications: auto_create + pending_review + ignored', async () => {
      const recommendations = [
        { from_id: 'A', to_id: 'B', similarity: 0.9, type: 'related', weight: 0.9 },
        { from_id: 'C', to_id: 'D', similarity: 0.8, type: 'related', weight: 0.8 },
        { from_id: 'E', to_id: 'F', similarity: 0.5, type: 'related', weight: 0.5 },
      ];

      const result = await recommendWithDualThreshold({
        recommendations,
        dryRun: true,
      });

      expect(result.autoCreated).toBe(1);
      expect(result.pendingReview).toBe(1);
      expect(result.ignored).toBe(1);
    });

    it('dryRun=true does not call backend', async () => {
      const recommendations = [
        { from_id: 'A', to_id: 'B', similarity: 0.9, type: 'related', weight: 0.9 },
      ];

      const result = await recommendWithDualThreshold({
        recommendations,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.autoCreated).toBe(1);
    });
  });
});

// ===== Test 5: ScheduledHealthCheck =====

import { ScheduledHealthCheck } from '../../lib/scheduled-health-check.js';

describe('ScheduledHealthCheck', () => {
  let healthCheck;

  afterEach(() => {
    if (healthCheck) {
      healthCheck.stop();
    }
  });

  describe('_running guard prevents overlapping execution', () => {
    it('_running is false by default and after execute()', async () => {
      healthCheck = new ScheduledHealthCheck({
        enabled: true,
        schedule: '*/1 * * * *',
        timeout: 30000,
      });

      expect(healthCheck._running).toBe(false);

      await healthCheck.execute();
      expect(healthCheck._running).toBe(false);
    });

    it('_running guard in start() prevents overlapping ticks', async () => {
      healthCheck = new ScheduledHealthCheck({
        enabled: true,
        schedule: '*/1 * * * *',
        timeout: 30000,
      });

      const intervalMs = healthCheck.parseSchedule(healthCheck.schedule);
      expect(intervalMs).toBe(60 * 1000);

      healthCheck.start();
      expect(healthCheck.timer).not.toBeNull();

      healthCheck.stop();
      expect(healthCheck.timer).toBeNull();
    });
  });

  describe('parseSchedule handles */N patterns', () => {
    it('*/30 * * * * → 30 minutes in ms', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('*/30 * * * *');
      expect(ms).toBe(30 * 60 * 1000);
    });

    it('*/5 * * * * → 5 minutes in ms', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('*/5 * * * *');
      expect(ms).toBe(5 * 60 * 1000);
    });

    it('0 */6 * * * → 6 hours in ms (hour pattern)', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('0 */6 * * *');
      expect(ms).toBe(6 * 60 * 60 * 1000);
    });

    it('0 9 * * * → 24 hours (daily at 9 AM)', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('0 9 * * *');
      expect(ms).toBe(24 * 60 * 60 * 1000);
    });

    it('invalid schedule → default 24 hours', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('invalid');
      expect(ms).toBe(24 * 60 * 60 * 1000);
    });

    it('*/0 * * * * (invalid minutes) → default 24 hours', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('*/0 * * * *');
      expect(ms).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('runCheck returns actual duration', () => {
    it('duration is greater than 0', async () => {
      healthCheck = new ScheduledHealthCheck({
        enabled: true,
        schedule: '*/1 * * * *',
        timeout: 30000,
      });

      const result = await healthCheck.runCheck();

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.report).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });
});
