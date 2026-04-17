/**
 * BatchProcessor - 代码分析批量处理器
 *
 * 管理分析队列、自动分批、并发控制
 * @version 1.0.0
 * @since v3.2.0
 */

import { getPrecomputeClient } from './client.js';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 2;

export class BatchProcessor {
  constructor({ batch_size = DEFAULT_BATCH_SIZE, concurrency = DEFAULT_CONCURRENCY } = {}) {
    this.batchSize = batch_size;
    this.concurrency = concurrency;
    this.client = getPrecomputeClient();
    this.results = [];
    this.errors = [];
  }

  async processAll(analysisResults, project_id, tenant_id) {
    const files = [];
    const symbols = [];
    const relations = [];

    for (const result of analysisResults) {
      files.push({
        path: result.file_path,
        content: result.content,
      });

      if (result.functions) {
        for (const fn of result.functions) {
          symbols.push({
            name: fn.name,
            type: 'function',
            line: fn.start,
            file_path: result.file_path,
          });
        }
      }

      if (result.classes) {
        for (const cls of result.classes) {
          symbols.push({
            name: cls.name,
            type: 'class',
            line: cls.start,
            file_path: result.file_path,
          });
        }
      }

      if (result.interfaces) {
        for (const iface of result.interfaces) {
          symbols.push({
            name: iface.name,
            type: 'interface',
            line: iface.start,
            file_path: result.file_path,
          });
        }
      }

      if (result.call_relations) {
        for (const rel of result.call_relations) {
          relations.push({
            from_symbol: rel.from,
            to_symbol: rel.to,
            type: rel.type || 'calls',
            line: rel.line,
            file_path: result.file_path,
            from_file: result.file_path,
          });
        }
      }
    }

    const result = await this.client.uploadAnalysisBatch({
      project_id,
      files,
      symbols,
      relations,
      batch_size: this.batchSize,
      tenant_id,
    });

    this.results.push(result);
    return result;
  }
}
