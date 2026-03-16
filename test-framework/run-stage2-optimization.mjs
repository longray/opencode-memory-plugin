#!/usr/bin/env node
/**
 * 阶段2深度优化测试
 * 包含：混合搜索算法优化 + 查询扩展功能
 */

import { BM25Index } from "../opencode-memory-plugin/lib/bm25.js";
import labeledDataset from "./labeled-dataset.mjs";
import { expandQuery, getSynonyms } from "./synonyms.js";

class Stage2OptimizedTools {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "http://localhost:18000/v1/embeddings";
    this.model = options.model || "Qwen3-Embedding-0.6B";
    this.embeddingDimension = options.embeddingDimension || 1024;

    this.memoryData = [];
    this.vectorIndex = new Map();
    this.embeddingCache = new Map();
    this.bm25PluginIndex = new BM25Index();

    // 阶段1优化配置
    this.searchConfig = {
      limits: {
        semantic: 10,
        keyword: 6,
        hybrid: 5,
      },
      minScores: {
        semantic: 0.1,
        keyword: 0.5,
        hybrid: 0.3,
      },
    };

    // 阶段2优化选项
    this.enableMultiplicativeFusion =
      options.enableMultiplicativeFusion ?? true;
    this.enableQueryExpansion = options.enableQueryExpansion ?? true;

    this.stats = {
      totalWrites: 0,
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      errors: 0,
      queryExpansions: 0,
    };

    console.log(`🔗 Stage2OptimizedTools initialized`);
    console.log(`   Limits: ${JSON.stringify(this.searchConfig.limits)}`);
    console.log(`   Multiplicative Fusion: ${this.enableMultiplicativeFusion}`);
    console.log(`   Query Expansion: ${this.enableQueryExpansion}`);
  }

  async getEmbedding(text) {
    const cacheKey = text.substring(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.embeddingCache.get(cacheKey);
    }

    this.stats.cacheMisses++;
    this.stats.apiCalls++;

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: text }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      let embedding;
      if (Array.isArray(data)) {
        embedding = data;
      } else if (
        data.data &&
        Array.isArray(data.data) &&
        data.data[0]?.embedding
      ) {
        embedding = data.data[0].embedding;
      } else if (data.embeddings && Array.isArray(data.embeddings)) {
        embedding = data.embeddings;
      } else {
        throw new Error("Unknown response format");
      }

      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

    const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));

    return norm1 > 0 && norm2 > 0 ? dotProduct / (norm1 * norm2) : 0;
  }

  async _addDocumentDirectly(id, content, type, tags) {
    const embedding = await this.getEmbedding(content);

    const record = {
      id,
      content,
      type,
      tags: typeof tags === "string" ? tags.split(",") : tags,
      timestamp: new Date().toISOString(),
      embedding,
    };

    this.memoryData.push(record);
    this.vectorIndex.set(id, embedding);
    this.bm25PluginIndex.addDocument(id, content, { type, tags: record.tags });

    return { success: true, id };
  }

  async loadLabeledDataset(dataset) {
    console.log(`Loading ${dataset.documents.length} documents...`);

    for (const doc of dataset.documents) {
      await this._addDocumentDirectly(doc.id, doc.content, doc.type, doc.tags);
    }

    console.log(`Loaded ${this.memoryData.length} documents`);
    return { loaded: dataset.documents.length };
  }

  /**
   * 混合搜索 - 乘法融合算法
   */
  hybridSearchMultiplicative(vectorScores, bm25Scores) {
    const results = [];

    for (const record of this.memoryData) {
      const vecScore = vectorScores.get(record.id) || 0;
      const bm25Score = bm25Scores.get(record.id) || 0;

      // 乘法融合: score = vec^0.7 * bm25^0.3
      // 归一化后计算
      const maxVec = Math.max(...vectorScores.values(), 1);
      const maxBM25 = Math.max(...bm25Scores.values(), 1);

      const normalizedVec = vecScore / maxVec;
      const normalizedBM25 = bm25Score / maxBM25;

      // 乘法融合
      const hybridScore =
        Math.pow(normalizedVec, 0.7) * Math.pow(normalizedBM25, 0.3);

      results.push({
        id: record.id,
        score: hybridScore,
        vectorScore: vecScore,
        bm25Score,
      });
    }

    return results;
  }

  /**
   * 关键词搜索
   */
  async memory_search({ query, scope = "all", limit = 10 }) {
    this.stats.totalSearches++;

    const optimizedLimit = this.searchConfig.limits.keyword;
    const minScore = this.searchConfig.minScores.keyword;

    const results = this.bm25PluginIndex.search(query, {
      limit: optimizedLimit,
      minScore,
    });

    return results.map((r) => {
      const record = this.memoryData.find((d) => d.id === r.id);
      return { ...record, score: r.score };
    });
  }
  /**
   * 混合搜索 - 动态权重算法
   */
  hybridSearchDynamicWeight(vectorScores, bm25Scores) {
    const results = [];
    const maxVec = Math.max(...vectorScores.values(), 1);
    const maxBM25 = Math.max(...bm25Scores.values(), 1);

    for (const record of this.memoryData) {
      const vecScore = vectorScores.get(record.id) || 0;
      const bm25Score = bm25Scores.get(record.id) || 0;

      const normalizedVec = vecScore / maxVec;
      const normalizedBM25 = bm25Score / maxBM25;

      // 动态权重：根据score绝对值调整权重
      // 向量分数越高，向量权重越大
      const vectorWeight = 0.6 + 0.2 * normalizedVec;
      const bm25Weight = 1 - vectorWeight;

      const hybridScore =
        vectorWeight * normalizedVec + bm25Weight * normalizedBM25;

      results.push({
        id: record.id,
        score: hybridScore,
        vectorScore: vecScore,
        bm25Score,
      });
    }

    return results;
  }

  async memory_search({ query, mode = "hybrid", limit = 10 }) {
    this.stats.totalSearches++;

    const optimizedLimit = this.searchConfig.limits[mode] || limit;
    const minScore = this.searchConfig.minScores[mode] || 0.1;

    // 查询扩展
    const expandedQueries = this.enableQueryExpansion
      ? expandQuery(query)
      : [query];
    if (expandedQueries.length > 1) {
      this.stats.queryExpansions++;
    }

    const queryEmbedding = await this.getEmbedding(query);

    if (mode === "keyword") {
      // 使用插件BM25
      const results = this.bm25PluginIndex.search(query, {
        limit: optimizedLimit,
        minScore,
      });

      return results.map((r) => {
        const record = this.memoryData.find((d) => d.id === r.id);
        return { ...record, score: r.score };
      });
    }

    // vector或hybrid模式
    const vectorScores = new Map();
    for (const record of this.memoryData) {
      vectorScores.set(
        record.id,
        this.cosineSimilarity(queryEmbedding, record.embedding),
      );
    }

    if (mode === "vector") {
      const sorted = [...vectorScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .filter(([_, score]) => score > 0)
        .slice(0, optimizedLimit);

      return sorted.map(([id, score]) => {
        const record = this.memoryData.find((d) => d.id === id);
        return { ...record, score };
      });
    }

    // hybrid模式 - 使用乘法融合
    const bm25Results = this.bm25PluginIndex.search(query, {
      limit: this.memoryData.length,
      minScore: this.searchConfig.minScores.hybrid,
    });

    const bm25Scores = new Map();
    for (const r of bm25Results) {
      bm25Scores.set(r.id, r.score);
    }

    let results;
    if (this.enableMultiplicativeFusion) {
      // 使用乘法融合
      results = this.hybridSearchMultiplicative(vectorScores, bm25Scores);
    } else {
      // 使用动态权重
      results = this.hybridSearchDynamicWeight(vectorScores, bm25Scores);
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, optimizedLimit)
      .map((r) => {
        const record = this.memoryData.find((d) => d.id === r.id);
        return {
          ...record,
          score: r.score,
          vectorScore: r.vectorScore || 0,
          bm25Score: r.bm25Score || 0,
        };
      });
  }

  getStats() {
    return {
      ...this.stats,
      documentCount: this.memoryData.length,
      bm25Stats: this.bm25PluginIndex.getStats(),
      config: this.searchConfig,
      stage2Options: {
        multiplicativeFusion: this.enableMultiplicativeFusion,
        queryExpansion: this.enableQueryExpansion,
      },
    };
  }
}

async function main() {
  console.log("🚀 阶段2深度优化测试");
  console.log("========================================\n");

  console.log("📋 优化配置:");
  console.log("   乘法融合: ✅ 启用");
  console.log("   查询扩展: ✅ 启用");
  console.log("   动态权重: ✅ 启用\n");

  // 测试不同的组合
  const testConfigs = [
    {
      name: "阶段1基准（已优化）",
      enableMultiplicativeFusion: false,
      enableQueryExpansion: false,
    },
    {
      name: "启用乘法融合",
      enableMultiplicativeFusion: true,
      enableQueryExpansion: false,
    },
    {
      name: "启用查询扩展",
      enableMultiplicativeFusion: false,
      enableQueryExpansion: true,
    },
    {
      name: "阶段2完整优化",
      enableMultiplicativeFusion: true,
      enableQueryExpansion: true,
    },
  ];

  const allResults = [];

  for (const config of testConfigs) {
    console.log(`\n📊 测试: ${config.name}`);
    console.log("----------------------------------------");

    const tools = new Stage2OptimizedTools(config);
    await tools.loadLabeledDataset(labeledDataset);

    const results = [];

    for (const query of labeledDataset.queries) {
      let searchResults;
      const limit = tools.searchConfig.limits[query.mode];

      if (query.mode === "keyword") {
        searchResults = await tools.memory_search({ query: query.query });
      } else {
        searchResults = await tools.memory_search({
          query: query.query,
          mode: query.mode,
          limit,
        });
      }

      const foundIds = new Set(searchResults.map((r) => r.id));
      const foundRelevant = query.relevant.filter((id) => foundIds.has(id));
      const recall =
        query.relevant.length > 0
          ? foundRelevant.length / query.relevant.length
          : 0;
      const precision =
        searchResults.length > 0
          ? foundRelevant.length / searchResults.length
          : 0;

      let mrr = 0;
      for (let i = 0; i < searchResults.length; i++) {
        if (query.relevant.includes(searchResults[i].id)) {
          mrr = 1 / (i + 1);
          break;
        }
      }

      results.push({
        query: query.query,
        mode: query.mode,
        recall,
        precision,
        mrr,
        resultCount: searchResults.length,
      });
    }

    const avgRecall =
      results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const avgPrecision =
      results.reduce((sum, r) => sum + r.precision, 0) / results.length;
    const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;

    // 按模式统计
    const modeStats = {};
    for (const r of results) {
      if (!modeStats[r.mode]) {
        modeStats[r.mode] = { recall: 0, precision: 0, mrr: 0, count: 0 };
      }
      modeStats[r.mode].recall += r.recall;
      modeStats[r.mode].precision += r.precision;
      modeStats[r.mode].mrr += r.mrr;
      modeStats[r.mode].count++;
    }
    for (const mode in modeStats) {
      modeStats[mode].recall /= modeStats[mode].count;
      modeStats[mode].precision /= modeStats[mode].count;
      modeStats[mode].mrr /= modeStats[mode].count;
    }

    allResults.push({
      config: config.name,
      avgRecall,
      avgPrecision,
      avgMRR,
      modeStats,
    });

    console.log(`   Recall@10:    ${(avgRecall * 100).toFixed(2)}%`);
    console.log(`   Precision@10: ${(avgPrecision * 100).toFixed(2)}%`);
    console.log(`   MRR:          ${avgMRR.toFixed(4)}`);

    console.log(`   按模式:`);
    for (const [mode, stats] of Object.entries(modeStats)) {
      console.log(
        `     ${mode.padEnd(10)}: Recall ${(stats.recall * 100).toFixed(1)}%, Precision ${(stats.precision * 100).toFixed(1)}%`,
      );
    }
  }

  // 显示对比
  console.log("\n" + "=".repeat(60));
  console.log("📊 阶段2优化测试结果汇总");
  console.log("=".repeat(60) + "\n");

  // 按Precision排序
  const sortedByPrecision = [...allResults].sort(
    (a, b) => b.avgPrecision - a.avgPrecision,
  );

  console.log("配置对比（按Precision排序）:\n");
  console.log(
    `${"配置".padEnd(25)} | ${"Recall@10".padStart(12)} | ${"Precision@10".padStart(12)} | ${"MRR".padStart(10)}`,
  );
  console.log("-".repeat(60));

  sortedByPrecision.forEach((result, i) => {
    const prefix = i === 0 ? "🏆" : "  ";
    console.log(
      `${prefix} ${result.config.padEnd(25)} | ${(result.avgRecall * 100).toFixed(2).padStart(11)}% | ${(result.avgPrecision * 100).toFixed(2).padStart(11)}% | ${result.avgMRR.toFixed(4).padStart(10)}`,
    );
  });

  const best = sortedByPrecision[0];
  console.log("\n" + "=".replace("=", 60));
  console.log("💡 最佳配置");
  console.log("=".replace("=", 60) + "\n");
  console.log(`${best.config}`);
  console.log(`\n总体指标:`);
  console.log(
    `  Recall@10:    ${(best.avgRecall * 100).toFixed(2)}% (目标: ≥70%)`,
  );
  console.log(
    `  Precision@10: ${(best.avgPrecision * 100).toFixed(2)}% (目标: ≥50%)`,
  );
  console.log(`  MRR:          ${best.avgMRR.toFixed(4)} (目标: ≥0.6)`);

  const allGoalsMet =
    best.avgRecall >= 0.7 && best.avgPrecision >= 0.5 && best.avgMRR >= 0.6;

  if (allGoalsMet) {
    console.log(`\n✅ 所有目标达成！阶段2优化成功！`);
  } else {
    console.log(`\n⚠️  部分目标未达成:`);
    if (best.avgRecall < 0.7) {
      console.log(
        `   Recall@10: 需要从${(best.avgRecall * 100).toFixed(1)}%提升到70%`,
      );
    }
    if (best.avgPrecision < 0.5) {
      console.log(
        `   Precision@10: 需要从${(best.avgPrecision * 100).toFixed(1)}%提升到50%`,
      );
    }
    if (best.avgMRR < 0.6) {
      console.log(`   MRR: 需要从${best.avgMRR.toFixed(4)}提升到0.6`);
    }
  }

  console.log("\n" + "=".replace("=", 60));

  return {
    bestConfig: best.config,
    avgRecall: best.avgRecall,
    avgPrecision: best.avgPrecision,
    avgMRR: best.avgMRR,
    allGoalsMet,
  };
}

main()
  .then((result) => {
    process.exit(result.allGoalsMet ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
