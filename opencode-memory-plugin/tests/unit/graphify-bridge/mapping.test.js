import { describe, it, expect } from '@jest/globals';
import {
  buildEntityPayload,
  buildAtomPayload,
  buildReferencePayload,
} from '../../../lib/graphify-bridge.js';

describe('buildEntityPayload', () => {
  it('should map code node to entity payload', () => {
    const node = {
      id: 'lib_wrapper-client_js',
      label: 'wrapper-client.js',
      file_type: 'code',
      source_file: 'lib/wrapper-client.js',
      source_location: '',
      community: 42,
      norm_label: 'wrapper-client.js',
    };
    const payload = buildEntityPayload(node, '@longray/opencode-memory-plugin', 'longray');
    expect(payload).toMatchObject({
      type: 'code',
      file_path: 'lib/wrapper-client.js',
      norm_label: 'wrapper-client.js',
      language: 'javascript',
      project: '@longray/opencode-memory-plugin',
      tenant_id: 'longray',
      created_by: 'graphify',
      tags: ['community:42'],
    });
  });

  it('should handle document file_type', () => {
    const node = {
      id: 'readme_md',
      label: 'README.md',
      file_type: 'document',
      source_file: 'README.md',
      source_location: '',
      community: 1,
      norm_label: 'readme.md',
    };
    const payload = buildEntityPayload(node, 'test-project', 'longray');
    expect(payload.type).toBe('document');
    expect(payload.language).toBe('markdown');
  });

  it('should handle node without community', () => {
    const node = {
      id: 'test_js',
      label: 'test.js',
      file_type: 'code',
      source_file: 'test.js',
      source_location: '',
    };
    const payload = buildEntityPayload(node, 'test', 'longray');
    expect(payload.tags).toEqual([]);
  });
});

describe('buildAtomPayload', () => {
  it('should strip () from function label', () => {
    const node = {
      id: 'lib_test_js_foo',
      label: 'getWebSocketClient()',
      file_type: 'code',
      source_file: 'lib/test.js',
      source_location: 'L206',
      community: 5,
      norm_label: 'getwebsocketclient()',
    };
    const payload = buildAtomPayload(node, 'test-project', 'longray');
    expect(payload.name).toBe('getWebSocketClient');
    expect(payload.type).toBe('function');
    expect(payload.start_line).toBe(206);
    expect(payload.metadata.graphify_id).toBe('lib_test_js_foo');
    expect(payload.entity_id).toBeNull();
  });

  it('should detect class type from PascalCase', () => {
    const node = {
      id: 'lib_test_js_bar',
      label: 'Bar',
      source_file: 'lib/test.js',
      source_location: 'LL10-50',
      community: 5,
      norm_label: 'bar',
    };
    const payload = buildAtomPayload(node, 'test-project', 'longray');
    expect(payload.type).toBe('class');
    expect(payload.start_line).toBe(10);
    expect(payload.end_line).toBe(50);
  });

  it('should include entity_id when provided', () => {
    const node = {
      id: 'lib_test_js_baz',
      label: 'baz()',
      source_file: 'lib/test.js',
      source_location: 'L30',
      norm_label: 'baz',
    };
    const payload = buildAtomPayload(node, 'test-project', 'longray', 'entity:abc123');
    expect(payload.entity_id).toBe('entity:abc123');
  });
});

describe('buildReferencePayload', () => {
  it('should calculate weight from relation and confidence', () => {
    const link = {
      source: 'a',
      target: 'b',
      relation: 'calls',
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      weight: 1,
      source_file: 'test.js',
      source_location: 'L10',
      context: 'call',
    };
    const payload = buildReferencePayload(link, 'entity:a', 'atom:b', 'longray');
    expect(payload.weight).toBe(0.7);
    expect(payload.confidence).toBe('EXTRACTED');
    expect(payload.confidence_score).toBe(1.0);
    expect(payload.line).toBe(10);
  });

  it('should use lower weight for INFERRED calls', () => {
    const link = {
      source: 'a',
      target: 'b',
      relation: 'calls',
      confidence: 'INFERRED',
      confidence_score: 0.8,
      weight: 1,
    };
    const payload = buildReferencePayload(link, 'entity:a', 'atom:b', 'longray');
    expect(payload.weight).toBe(0.5);
  });
});
