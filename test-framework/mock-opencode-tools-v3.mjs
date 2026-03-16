/**
 * Mock OpenCode工具（简化版，修复语法错误）
 * 支持两种模式：real（真实API）和 mock（模拟）
 */

class MockOpenCodeTools {
  constructor(options = {}) {
    this.memoryData = [];
    this.bm25Index = new Map();
    this.vectorIndex = new Map();
    this.embeddingCache = new Map();

    // 配置项
    this.embeddingMode = options.embeddingMode || "real";
    this.apiEndpoint =
      options.apiEndpoint ||
      "https://api-inference.modelscope.cn/v1/embeddings";
    this.apiKey = options.apiKey || process.env.MODELSCOPE_API_KEY;
    this.model = options.model || "Qwen/Qwen3-Embedding-0.6B";
    this.vectorDimensions = 1024;
    this.mockDimensions = 100;
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

    // 生成并缓存embedding
    try {
      const embedding = await this.generateEmbedding(content);
      this.vectorIndex.set(record.id, embedding);
    } catch (error) {
      console.error(
        `Failed to generate embedding for record ${record.id}:`,
        error,
      );
    }

    this.buildBM25Index();
    return { success: true, id: record.id };
  }

  /**
   * 生成embedding（根据模式选择）
   */
  async generateEmbedding(text) {
    if (this.embeddingMode === "real") {
      return await this.generateRealEmbedding(text);
    } else {
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * 真实embedding（调用ModelScope API）
   */
  async generateRealEmbedding(text) {
    const cacheKey = this.hashCode(text).toString();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: "float",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      let embedding;
      if (data.data && data.data[0] && data.data[0].embedding) {
        embedding = data.data[0].embedding;
      } else if (Array.isArray(data) && data[0] && data[0].embedding) {
        embedding = data[0].embedding;
      } else if (data.embeddings) {
        embedding = data.embeddings[0];
      } else {
        throw new Error("Unknown API response format");
      }

      if (embedding.length !== this.vectorDimensions) {
        console.warn(
          `Embedding dimension mismatch: expected ${this.vectorDimensions}, got ${embedding.length}`,
        );
      }

      this.embeddingCache.set(cacheKey, embedding);
      console.log(`✅ Real embedding generated in ${duration}ms`);

      return embedding;
    } catch (error) {
      console.error("Real embedding API error:", error);
      console.warn("Falling back to mock embedding");

      const mockEmbedding = this.generateMockEmbedding(text);
      this.embeddingCache.set(cacheKey, mockEmbedding);
      return mockEmbedding;
    }
  }

  /**
   * 模拟embedding（哈希方法）
   */
  generateMockEmbedding(text) {
    const terms = this.tokenize(text);
    const embedding = new Array(this.mockDimensions).fill(0);

    terms.forEach((term) => {
      const hash = this.hashCode(term) % this.mockDimensions;
      embedding[Math.abs(hash)] += 1;
    });

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map((val) => val / norm) : embedding;
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
    const minDim = Math.min(vec1.length, vec2.length);

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < minDim; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
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
   * 向量搜索
   */
  vectorSearch(query, queryVector) {
    const similarities = this.memoryData.map((record) => {
      const recordVector = this.vectorIndex.get(record.id);
      return {
        record,
        similarity: this.cosineSimilarity(queryVector, recordVector),
      };
    });

    return similarities
      .filter((s) => s.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map((s) => s.record);
  }

  /**
   * 混合搜索（70%向量 + 30%BM25）
   */
  hybridSearch(query, queryVector) {
    const bm25Results = this.bm25Search(query);
    const vectorResults = this.vectorSearch(query, queryVector);

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
   * 关键词搜索
   */
  async memory_search({ query, scope }) {
    const records =
      scope === "all"
        ? this.memoryData
        : this.memoryData.filter((r) => r.type === scope);

    if (records.length === 0) {
      return [];
    }

    this.buildBM25Index();
    return this.bm25Search(query);
  }

  /**
   * 向量搜索（支持多种模式）
   */
  async memory_search({ query, mode }) {
    // 生成查询向量
    let queryVector;
    try {
      queryVector = await this.generateEmbedding(query);
    } catch (error) {
      console.error("Failed to generate query embedding:", error);
      return [];
    }

    switch (mode) {
      case "vector":
        return this.vectorSearch(query, queryVector);
      case "keyword":
        return this.bm25Search(query);
      case "hash":
        return this.memoryData.filter(
          (r) =>
            r.content.toLowerCase().includes(query.toLowerCase()) ||
            r.tags.toLowerCase().includes(query.toLowerCase()),
        );
      case "hybrid":
      default:
        return this.hybridSearch(query, queryVector);
    }
  }

  /**
   * 列出每日日志
   */
  async list_daily() {
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
    return { success: true, message: "Daily log initialized" };
  }

  /**
   * 重建索引
   */
  async rebuild_index() {
    this.buildBM25Index();

    // 重建向量索引
    const rebuildPromises = this.memoryData.map(async (record) => {
      try {
        const embedding = await this.generateEmbedding(record.content);
        this.vectorIndex.set(record.id, embedding);
        return { id: record.id, success: true };
      } catch (error) {
        console.error(
          `Failed to rebuild index for record ${record.id}:`,
          error,
        );
        return { id: record.id, success: false };
      }
    });

    const results = await Promise.all(rebuildPromises);
    const successCount = results.filter((r) => r.success).length;

    return {
      success: true,
      message: "Index rebuilt",
      totalRecords: this.memoryData.length,
      indexedRecords: successCount,
      failedRecords: this.memoryData.length - successCount,
    };
  }

  /**
   * 索引状态
   */
  async index_status() {
    return {
      totalRecords: this.memoryData.length,
      indexedRecords: this.vectorIndex.size,
      lastRebuild: new Date().toISOString(),
      bm25IndexSize: this.bm25Index.size,
      vectorIndexSize: this.vectorIndex.size,
      embeddingCacheSize: this.embeddingCache.size,
      embeddingMode: this.embeddingMode,
      apiKey: this.apiKey ? "***" + this.apiKey.slice(-4) : "none",
    };
  }
}

export default MockOpenCodeTools;
