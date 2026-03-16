/**
 * 改进的Mock OpenCode工具
 * 实现了BM25搜索和向量搜索模拟
 */

class MockOpenCodeTools {
  constructor() {
    this.memoryData = [];
    this.bm25Index = new Map();
    this.vectorIndex = new Map();
  }

  /**
   * 写入记忆
   */
  async memory_write({ content, type, tags }) {
    const record = {
      id: Date.now() + Math.random(),
      content,
      type,
      tags,
      timestamp: new Date().toISOString(),
    };
    this.memoryData.push(record);
    this.buildBM25Index(); // 重建BM25索引
    this.buildVectorIndex(); // 重建向量索引
    return { success: true, id: record.id };
  }

  /**
   * 读取记忆
   */
  async memory_read({ type }) {
    const records = type
      ? this.memoryData.filter((r) => r.type === type)
      : this.memoryData;
    return records;
  }

  /**
   * BM25索引构建
   */
  buildBM25Index() {
    this.bm25Index.clear();
    const documents = this.memoryData.map((record) => ({
      id: record.id,
      content: record.content,
      tags: record.tags,
    }));

    documents.forEach((doc) => {
      const terms = this.tokenize(doc.content + " " + doc.tags);
      terms.forEach((term) => {
        if (!this.bm25Index.has(term)) {
          this.bm25Index.set(term, new Map());
        }
        const postings = this.bm25Index.get(term);
        const docLength = postings.get(doc.id);
        postings.set(doc.id, (docLength || 0) + 1);
      });
    });
  }

  /**
   * 向量索引构建
   */
  buildVectorIndex() {
    this.vectorIndex.clear();
    this.memoryData.forEach((record) => {
      const embedding = this.generateEmbedding(record.content);
      this.vectorIndex.set(record.id, embedding);
    });
  }

  /**
   * 分词
   */
  tokenize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, "")
      .split(/\s+/)
      .filter((term) => term.length > 0);
  }

  /**
   * BM25搜索算法
   */
  bm25Search(query, k1 = 1.5, b = 0.75) {
    const queryTerms = this.tokenize(query);
    const scores = new Map();
    const avgDocLength =
      this.memoryData.reduce((sum, r) => sum + r.content.length, 0) /
      this.memoryData.length;

    this.memoryData.forEach((record) => {
      let score = 0;
      const docLength = record.content.length;

      queryTerms.forEach((term) => {
        const postings = this.bm25Index.get(term);
        if (postings) {
          const tf = postings.get(record.id) || 0;
          const df = postings.size;
          const N = this.memoryData.length;
          const idf = Math.log((N - df + 0.5) / (df + 0.5));
          score +=
            (idf * (tf * (k1 + 1))) /
            (tf + k1 * (1 - b + (b * docLength) / avgDocLength));
        }
      });
      scores.set(record.id, score);
    });

    return Array.from(scores.entries())
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => this.memoryData.find((r) => r.id === id));
  }

  /**
   * 生成简单的embedding（模拟向量）
   */
  generateEmbedding(text) {
    const terms = this.tokenize(text);
    const embedding = new Array(100).fill(0);
    terms.forEach((term) => {
      const hash = this.hashCode(term) % 100;
      embedding[Math.abs(hash)] += 1;
    });

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map((val) => val / norm) : embedding;
  }

  /**
   * 哈希函数
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * 余弦相似度
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * 向量搜索（模拟）
   */
  vectorSearch(query, mode = "vector") {
    const queryVector = this.generateEmbedding(query);
    const similarities = this.memoryData.map((record) => {
      const recordVector = this.vectorIndex.get(record.id);
      return {
        record,
        similarity: this.cosineSimilarity(queryVector, recordVector),
      };
    });

    return similarities
      .filter((s) => s.similarity > 0.1) // 过滤低相似度结果
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map((s) => s.record);
  }

  /**
   * 混合搜索（70%向量 + 30%BM25）
   */
  hybridSearch(query) {
    const bm25Results = this.bm25Search(query);
    const vectorResults = this.vectorSearch(query, "vector");

    // 为BM25结果评分
    const bm25Scores = new Map();
    bm25Results.forEach((record, index) => {
      bm25Scores.set(record.id, bm25Results.length - index);
    });

    // 为向量结果评分
    const vectorScores = new Map();
    vectorResults.forEach((record, index) => {
      vectorScores.set(record.id, vectorResults.length - index);
    });

    // 合并结果
    const combined = new Map();
    bm25Results.forEach((record) => {
      if (!combined.has(record.id)) {
        combined.set(record.id, {
          record,
          bm25Score: bm25Scores.get(record.id) || 0,
          vectorScore: vectorScores.get(record.id) || 0,
        });
      }
    });

    vectorResults.forEach((record) => {
      if (combined.has(record.id)) {
        combined.get(record.id).vectorScore = vectorScores.get(record.id);
      } else {
        combined.set(record.id, {
          record,
          bm25Score: bm25Scores.get(record.id) || 0,
          vectorScore: vectorScores.get(record.id),
        });
      }
    });

    // 计算混合分数（70%向量 + 30%BM25）
    const finalResults = Array.from(combined.values())
      .map((item) => ({
        record: item.record,
        score: 0.7 * item.vectorScore + 0.3 * item.bm25Score,
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.record);

    return finalResults;
  }

  /**
   * 关键词搜索（使用BM25）
   */
  async memory_search({ query, scope }) {
    const records =
      scope === "all"
        ? this.memoryData
        : this.memoryData.filter((r) => r.type === scope);

    if (records.length === 0) {
      return [];
    }

    // 使用BM25搜索
    this.buildBM25Index();
    return this.bm25Search(query);
  }

  /**
   * 向量搜索（支持多种模式）
   */
  async memory_search({ query, mode }) {
    switch (mode) {
      case "vector":
        return this.vectorSearch(query, mode);
      case "keyword":
        return this.bm25Search(query);
      case "hash":
        // 哈希搜索（快速但精度低）
        return this.memoryData.filter(
          (r) =>
            r.content.toLowerCase().includes(query.toLowerCase()) ||
            r.tags.toLowerCase().includes(query.toLowerCase()),
        );
      case "hybrid":
      default:
        return this.hybridSearch(query);
    }
  }

  /**
   * 列出每日日志
   */
  async list_daily() {
    // 返回模拟的日志文件列表
    return this.memoryData
      .filter((r) => r.type === "daily")
      .map((r) => ({
        date: r.timestamp.split("T")[0],
        type: r.type,
        id: r.id,
      }));
  }

  /**
   * 初始化今日日志
   */
  async init_daily() {
    // 模拟初始化日志
    return { success: true, message: "Daily log initialized" };
  }

  /**
   * 重建索引
   */
  async rebuild_index() {
    this.buildBM25Index();
    this.buildVectorIndex();
    return {
      success: true,
      message: "Index rebuilt",
      totalRecords: this.memoryData.length,
      indexedRecords: this.memoryData.length,
    };
  }

  /**
   * 索引状态
   */
  async index_status() {
    return {
      totalRecords: this.memoryData.length,
      indexedRecords: this.memoryData.length,
      lastRebuild: new Date().toISOString(),
      bm25IndexSize: this.bm25Index.size,
      vectorIndexSize: this.vectorIndex.size,
    };
  }
}

export default MockOpenCodeTools;
