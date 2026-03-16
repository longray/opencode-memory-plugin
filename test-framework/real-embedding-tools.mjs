import { BM25Index } from "../opencode-memory-plugin/lib/bm25.js";

/**
 * 真实Embedding测试工具类
 * 连接到 localhost:18000 的 Qwen3-Embedding-0.6B 服务
 * 用于搜索质量测试
 */

class RealEmbeddingTools {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "http://localhost:18000/v1/embeddings";
    this.model = options.model || "Qwen3-Embedding-0.6B";
    this.embeddingDimension = options.embeddingDimension || 1024;

    // 内存存储
    this.memoryData = [];
    this.vectorIndex = new Map();
    this.embeddingCache = new Map();

    // BM25索引
    this.bm25Index = new Map();
    this.documentFrequency = new Map();
    this.averageDocLength = 0;

    // 统计
    this.stats = {
      totalWrites: 0,
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      errors: 0,
    };

    console.log(
      `🔗 RealEmbeddingTools initialized with endpoint: ${this.endpoint}`,
    );
  }

  /**
   * 获取真实embedding
   */
  async getEmbedding(text) {
    // 检查缓存
    const cacheKey = text.substring(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.embeddingCache.get(cacheKey);
    }

    this.stats.cacheMisses++;

    try {
      this.stats.apiCalls++;
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
        timeout: 30000,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      // 缓存结果
      this.embeddingCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      this.stats.errors++;
      console.error(
        `Embedding API error for "${text.substring(0, 50)}...":`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * 批量获取embedding
   */
  async getBatchEmbeddings(texts) {
    const results = [];
    const uncached = [];
    const uncachedIndices = [];

    // 检查缓存
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = texts[i].substring(0, 100);
      if (this.embeddingCache.has(cacheKey)) {
        this.stats.cacheHits++;
        results[i] = this.embeddingCache.get(cacheKey);
      } else {
        this.stats.cacheMisses++;
        uncached.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // 批量请求未缓存的
    if (uncached.length > 0) {
      try {
        this.stats.apiCalls++;
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: uncached }),
          timeout: 60000,
        });

        if (!response.ok) {
          throw new Error(`Batch API error: ${response.status}`);
        }

        const data = await response.json();

        for (let i = 0; i < uncached.length; i++) {
          const embedding = data.data[i].embedding;
          const originalIndex = uncachedIndices[i];
          results[originalIndex] = embedding;

          // 缓存
          const cacheKey = uncached[i].substring(0, 100);
          this.embeddingCache.set(cacheKey, embedding);
        }
      } catch (error) {
        this.stats.errors++;
        console.error("Batch embedding error:", error.message);
        throw error;
      }
    }

    return results;
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

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
   * 分词 - 支持中文和英文
   */
  tokenize(text) {
    const lowerText = text.toLowerCase();

    // 第一步：按空格分割（处理英文）
    const spaceSplit = lowerText
      .replace(/[^\w\u4e00-\u9fa5\s]/g, " ")
      .split(/\s+/);

    const tokens = [];

    for (const part of spaceSplit) {
      if (!part || part.trim() === "") continue;

      // 检查是否包含中文
      const hasChinese = /[\u4e00-\u9fa5]/.test(part);

      if (hasChinese) {
        // 中文部分：按字符切分，保留2字以上词组和单个字符
        const chineseWords = part.match(/[\u4e00-\u9fa5]{2,}/g) || [];
        const singleChars = part.match(/[\u4e00-\u9fa5]/g) || [];

        tokens.push(...chineseWords);
        tokens.push(...singleChars);

        // 同时也保留混合的英文部分
        const englishParts = part.match(/[a-z0-9]+/g) || [];
        tokens.push(...englishParts.filter((w) => w.length > 1));
      } else {
        // 纯英文部分：直接作为token，过滤长度为1的
        if (part.length > 1) {
          tokens.push(part);
        }
      }
    }

    return tokens;
  }

  /**
   * 构建BM25索引
   */
  buildBM25Index() {
    this.bm25Index.clear();
    this.documentFrequency.clear();

    let totalLength = 0;

    for (const record of this.memoryData) {
      const tokens = this.tokenize(record.content);
      totalLength += tokens.length;

      const termFrequency = new Map();
      for (const token of tokens) {
        termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
      }

      this.bm25Index.set(record.id, termFrequency);

      for (const token of termFrequency.keys()) {
        this.documentFrequency.set(
          token,
          (this.documentFrequency.get(token) || 0) + 1,
        );
      }
    }

    this.averageDocLength =
      this.memoryData.length > 0 ? totalLength / this.memoryData.length : 1;
  }

  /**
   * BM25评分
   */
  bm25Score(query, docId, k1 = 1.5, b = 0.75) {
    const queryTokens = this.tokenize(query);
    const termFrequency = this.bm25Index.get(docId);

    if (!termFrequency) return 0;

    const docLength = Array.from(termFrequency.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const N = this.memoryData.length;

    let score = 0;

    for (const token of queryTokens) {
      const tf = termFrequency.get(token) || 0;
      const df = this.documentFrequency.get(token) || 0;

      if (df === 0) continue;

      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      const norm = 1 - b + b * (docLength / this.averageDocLength);
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * norm);

      score += idf * tfNorm;
    }

    return score;
  }

  /**
   * 写入记忆
   */
  async memory_write({ content, type = "long-term", tags = [] }) {
    if (!content || content.trim() === "") {
      throw new Error("Content cannot be empty");
    }

    this.stats.totalWrites++;

    const id = Date.now() + Math.random();
    const timestamp = new Date().toISOString();
    const tagArray =
      typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags;

    // 获取embedding
    const embedding = await this.getEmbedding(content);

    const record = {
      id,
      content,
      type,
      tags: tagArray,
      timestamp,
      embedding,
    };

    this.memoryData.push(record);
    this.vectorIndex.set(id, embedding);

    // 更新BM25索引
    this.buildBM25Index();

    return { success: true, id };
  }

  /**
   * 读取记忆
   */
  async memory_read({ type, limit = 100 }) {
    let records = this.memoryData;

    if (type) {
      records = records.filter((r) => r.type === type);
    }

    return records.slice(-limit).reverse();
  }

  /**
   * 关键词搜索
   */
  async memory_search({ query, scope = "all", limit = 10 }) {
    this.stats.totalSearches++;

    let records = this.memoryData;

    if (scope !== "all") {
      records = records.filter((r) => r.type === scope);
    }

    // BM25搜索
    const results = records
      .map((record) => ({
        ...record,
        score: this.bm25Score(query, record.id),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * 向量搜索
   */
  async memory_search({ query, mode = "hybrid", limit = 10 }) {
    this.stats.totalSearches++;

    const queryEmbedding = await this.getEmbedding(query);
    const queryTokens = this.tokenize(query);

    // 向量搜索
    const vectorResults = this.memoryData.map((record) => {
      const similarity = this.cosineSimilarity(
        queryEmbedding,
        record.embedding,
      );
      return { ...record, vectorScore: similarity };
    });

    // 根据模式处理
    let results;

    switch (mode) {
      case "vector":
        results = vectorResults
          .filter((r) => r.vectorScore > 0)
          .sort((a, b) => b.vectorScore - a.vectorScore)
          .slice(0, limit);
        break;

      case "keyword":
        results = this.memoryData
          .map((record) => ({
            ...record,
            bm25Score: this.bm25Score(query, record.id),
          }))
          .filter((r) => r.bm25Score > 0)
          .sort((a, b) => b.bm25Score - a.bm25Score)
          .slice(0, limit);
        break;

      case "hybrid":
      default:
        // BM25分数归一化
        const bm25Results = this.memoryData.map((record) => ({
          ...record,
          bm25Score: this.bm25Score(query, record.id),
        }));

        const maxBM25 = Math.max(...bm25Results.map((r) => r.bm25Score), 1);

        // 混合评分：70%向量 + 30%BM25
        results = vectorResults
          .map((vr, i) => {
            const normalizedBM25 = bm25Results[i].bm25Score / maxBM25;
            const hybridScore = 0.7 * vr.vectorScore + 0.3 * normalizedBM25;

            return {
              ...vr,
              bm25Score: bm25Results[i].bm25Score,
              score: hybridScore,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        break;
    }

    return results;
  }

  /**
   * 列出每日日志
   */
  async list_daily(options = {}) {
    const { days = 7 } = options;
    const dailyRecords = this.memoryData.filter((r) => r.type === "daily");
    const daysSet = new Set(dailyRecords.map((r) => r.timestamp.split("T")[0]));
    return Array.from(daysSet).sort().reverse().slice(0, days);
  }

  /**
   * 初始化今日日志
   */
  async init_daily(options = {}) {
    const { date } = options;
    const today = date || new Date().toISOString().split("T")[0];

    const existing = this.memoryData.find(
      (r) => r.type === "daily" && r.timestamp.startsWith(today),
    );

    if (existing) {
      return { success: true, message: "Daily log already exists" };
    }

    await this.memory_write({
      content: `Daily log for ${today}`,
      type: "daily",
      tags: ["daily"],
    });

    return { success: true, message: "Daily log initialized" };
  }

  /**
   * 重建索引
   */
  async rebuild_index(options = {}) {
    console.log(`Rebuilding index...`);

    // 重建BM25索引
    this.buildBM25Index();

    // 重建向量索引（如果有缓存则使用缓存）
    for (const record of this.memoryData) {
      if (!record.embedding) {
        record.embedding = await this.getEmbedding(record.content);
        this.vectorIndex.set(record.id, record.embedding);
      }
    }

    return {
      success: true,
      message: "Index rebuilt",
      totalRecords: this.memoryData.length,
    };
  }

  /**
   * 索引状态
   */
  async index_status() {
    return {
      success: true,
      totalRecords: this.memoryData.length,
      vectorIndexSize: this.vectorIndex.size,
      bm25IndexSize: this.bm25Index.size,
      embeddingCacheSize: this.embeddingCache.size,
      embeddingMode: "real",
      apiEndpoint: this.endpoint,
      model: this.model,
      stats: this.stats,
    };
  }

  /**
   * 加载标注数据集
   */
  async loadLabeledDataset(dataset) {
    console.log(
      `Loading ${dataset.documents.length} documents from labeled dataset...`,
    );

    // 批量获取embeddings
    const contents = dataset.documents.map((d) => d.content);
    const embeddings = await this.getBatchEmbeddings(contents);

    for (let i = 0; i < dataset.documents.length; i++) {
      const doc = dataset.documents[i];
      const embedding = embeddings[i];

      const record = {
        id: doc.id,
        content: doc.content,
        type: doc.type || "long-term",
        tags: doc.tags || [],
        timestamp: new Date().toISOString(),
        embedding,
      };

      this.memoryData.push(record);
      this.vectorIndex.set(doc.id, embedding);
    }

    // 构建BM25索引
    this.buildBM25Index();

    console.log(`Loaded ${this.memoryData.length} documents total`);

    return {
      success: true,
      loaded: dataset.documents.length,
      total: this.memoryData.length,
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      memoryDataSize: this.memoryData.length,
      vectorIndexSize: this.vectorIndex.size,
      embeddingCacheSize: this.embeddingCache.size,
      cacheHitRate:
        this.stats.cacheHits + this.stats.cacheMisses > 0
          ? (
              (this.stats.cacheHits /
                (this.stats.cacheHits + this.stats.cacheMisses)) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }
}

export default RealEmbeddingTools;
