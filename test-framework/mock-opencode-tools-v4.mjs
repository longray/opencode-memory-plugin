/**
 * Mock OpenCode工具 - 批量本地服务版本
 * 专门优化用于 localhost:18000 的批量嵌入服务
 * 支持批量请求（1-256条文本）和缓存利用
 */

class MockOpenCodeTools {
  constructor(options = {}) {
    this.memoryData = [];
    this.bm25Index = new Map();
    this.vectorIndex = new Map();
    this.embeddingCache = new Map();

    // 配置项
    this.embeddingMode = options.embeddingMode || "local"; // 默认使用本地服务
    this.apiEndpoint =
      options.apiEndpoint || "http://localhost:18000/v1/embeddings";
    this.model = options.model || "Qwen3-Embedding-0.6B";
    this.vectorDimensions = 1024;
    this.mockDimensions = 100;
    this.maxBatchSize = options.maxBatchSize || 256; // 本地服务最大批量

    // 批量处理队列
    this.embeddingQueue = [];
    this.batchTimeout = 10; // 10ms后批量提交
    this.batchTimer = null;
    this.batchPromises = new Map();
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

    // 生成embedding（使用批量处理）
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
    if (this.embeddingMode === "local") {
      return await this.generateLocalEmbedding(text);
    } else if (this.embeddingMode === "real") {
      return await this.generateRealEmbedding(text);
    } else {
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * 批量生成embeddings（本地服务优化）
   */
  async generateBatchEmbeddings(texts) {
    if (texts.length === 0) return [];

    if (this.embeddingMode === "mock") {
      return texts.map((text) => this.generateMockEmbedding(text));
    }

    const startTime = Date.now();

    try {
      // 构建批量请求
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts, // 批量输入
          encoding_format: "float",
          dimensions: this.vectorDimensions,
          normalize: true,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Local API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // 提取embeddings（OpenAI兼容格式）
      let embeddings;
      if (data.data && Array.isArray(data.data)) {
        embeddings = data.data.map((item) => item.embedding);
      } else {
        throw new Error("Unknown API response format");
      }

      if (embeddings.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`,
        );
      }

      console.log(
        `✅ Batch embeddings generated: ${texts.length} texts in ${duration}ms (${(duration / texts.length).toFixed(2)}ms/text)`,
      );

      // 缓存结果
      texts.forEach((text, index) => {
        const cacheKey = this.hashCode(text).toString();
        this.embeddingCache.set(cacheKey, embeddings[index]);
      });

      return embeddings;
    } catch (error) {
      console.error("Batch embedding API error:", error);
      console.warn("Falling back to individual requests or mock embeddings");

      // 降级：逐个请求
      if (this.embeddingMode === "local") {
        return await Promise.all(
          texts.map((text) => this.generateRealEmbedding(text)),
        );
      } else {
        return texts.map((text) => this.generateMockEmbedding(text));
      }
    }
  }

  /**
   * 本地embedding（调用localhost:18000）
   * 带缓存检查
   */
  async generateLocalEmbedding(text) {
    const cacheKey = this.hashCode(text).toString();
    if (this.embeddingCache.has(cacheKey)) {
      console.log(`✅ Cache hit for text: ${text.substring(0, 30)}...`);
      return this.embeddingCache.get(cacheKey);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: "float",
          dimensions: this.vectorDimensions,
          normalize: true,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Local API error: ${response.status} ${response.statusText}`,
        );
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
      console.log(`✅ Local embedding generated in ${duration}ms`);

      return embedding;
    } catch (error) {
      console.error("Local embedding API error:", error);
      console.warn("Falling back to mock embedding");

      const mockEmbedding = this.generateMockEmbedding(text);
      this.embeddingCache.set(cacheKey, mockEmbedding);
      return mockEmbedding;
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
    if (queryTerms.length === 0) return [];

    const avgDocLength =
      this.memoryData.reduce((sum, doc) => sum + doc.content.length, 0) /
        this.memoryData.length || 1;
    const scores = new Map();

    queryTerms.forEach((term) => {
      const postings = this.bm25Index.get(term);
      if (!postings) return;

      const df = postings.size;
      const idf = Math.log(
        (this.memoryData.length - df + 0.5) / (df + 0.5) + 1,
      );

      postings.forEach((tf, docId) => {
        const doc = this.memoryData.find((d) => d.id === docId);
        if (!doc) return;

        const docLength = doc.content.length;
        const normalizedTF =
          (tf * (k1 + 1)) /
          (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
        const score = idf * normalizedTF;

        scores.set(docId, (scores.get(docId) || 0) + score);
      });
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({
        id,
        score,
        record: this.memoryData.find((d) => d.id === id),
      }))
      .filter((item) => item.record)
      .map((item) => ({
        id: item.id,
        content: item.record.content,
        type: item.record.type,
        tags: item.record.tags,
        timestamp: item.record.timestamp,
        score: item.score,
      }));
  }

  /**
   * 向量搜索（余弦相似度）
   */
  vectorSearch(query, queryVector) {
    const results = [];
    const queryVec = queryVector || this.generateMockEmbedding(query);

    this.memoryData.forEach((record) => {
      const embedding = this.vectorIndex.get(record.id);
      if (!embedding) return;

      const similarity = this.cosineSimilarity(queryVec, embedding);
      if (similarity > 0.1) {
        // 阈值
        results.push({
          id: record.id,
          content: record.content,
          type: record.type,
          tags: record.tags,
          timestamp: record.timestamp,
          score: similarity,
        });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 混合搜索（70%向量 + 30%BM25）
   */
  hybridSearch(query, queryVector) {
    const vectorResults = this.vectorSearch(query, queryVector);
    const bm25Results = this.bm25Search(query);

    // 合并结果
    const combinedScores = new Map();
    const vectorMax = Math.max(...vectorResults.map((r) => r.score), 1);
    const bm25Max = Math.max(...bm25Results.map((r) => r.score), 1);

    // 向量得分（归一化后70%权重）
    vectorResults.forEach((item) => {
      const normalizedScore = item.score / vectorMax;
      combinedScores.set(
        item.id,
        (combinedScores.get(item.id) || 0) + 0.7 * normalizedScore,
      );
    });

    // BM25得分（归一化后30%权重）
    bm25Results.forEach((item) => {
      const normalizedScore = item.score / bm25Max;
      combinedScores.set(
        item.id,
        (combinedScores.get(item.id) || 0) + 0.3 * normalizedScore,
      );
    });

    return Array.from(combinedScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => {
        const record = this.memoryData.find((d) => d.id === id);
        return {
          id,
          content: record.content,
          type: record.type,
          tags: record.tags,
          timestamp: record.timestamp,
          score,
        };
      });
  }

  /**
   * 关键词搜索
   */
  async memory_search({ query, scope = "all", limit = 10 }) {
    const results = this.bm25Search(query);
    return results.slice(0, limit);
  }

  /**
   * 语义搜索
   */
  async memory_search({ query, mode = "hybrid", limit = 10 }) {
    let results = [];
    const queryVector = await this.generateEmbedding(query);

    if (mode === "hybrid") {
      results = this.hybridSearch(query, queryVector);
    } else if (mode === "vector") {
      results = this.vectorSearch(query, queryVector);
    } else if (mode === "keyword" || mode === "bm25") {
      results = this.bm25Search(query);
    } else if (mode === "hash") {
      // 哈希搜索：快速字符串匹配
      const queryLower = query.toLowerCase();
      results = this.memoryData
        .filter((record) => record.content.toLowerCase().includes(queryLower))
        .map((record) => ({
          id: record.id,
          content: record.content,
          type: record.type,
          tags: record.tags,
          timestamp: record.timestamp,
          score: 1.0,
        }));
    }

    return results.slice(0, limit);
  }

  /**
   * 读取记忆
   */
  async memory_read({ type, limit = 10 }) {
    let records = this.memoryData;
    if (type && type !== "all") {
      records = records.filter((r) => r.type === type);
    }
    return records.slice(-limit).reverse();
  }

  /**
   * 列出每日日志
   */
  async list_daily({ days = 7 }) {
    const dailyRecords = this.memoryData.filter((r) => r.type === "daily");
    const daysSet = new Set(dailyRecords.map((r) => r.timestamp.split("T")[0]));
    return Array.from(daysSet).sort().reverse().slice(0, days);
  }

  /**
   * 初始化今日日志
   */
  async init_daily({ date }) {
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
  async rebuild_index({ force = false }) {
    console.log(`Rebuilding index (force=${force})...`);
    this.buildBM25Index();

    // 批量重建向量索引（使用批量API）
    const texts = this.memoryData.map((r) => r.content);
    if (texts.length > 0) {
      const batchSize = Math.min(this.maxBatchSize, texts.length);
      const batches = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        batches.push(texts.slice(i, i + batchSize));
      }

      console.log(
        `Rebuilding vector index in ${batches.length} batches of ${batchSize}...`,
      );
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const embeddings = await this.generateBatchEmbeddings(batch);
        batch.forEach((text, j) => {
          const record = this.memoryData[i * batchSize + j];
          if (record && embeddings[j]) {
            this.vectorIndex.set(record.id, embeddings[j]);
          }
        });
        console.log(`  Batch ${i + 1}/${batches.length} completed`);
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
      embeddingMode: this.embeddingMode,
      apiEndpoint: this.apiEndpoint,
      model: this.model,
    };
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const totalHits = Array.from(this.embeddingCache.keys()).length;
    return {
      totalHits,
      cacheSize: this.embeddingCache.size,
      hitRate:
        this.memoryData.length > 0
          ? ((totalHits / this.memoryData.length) * 100).toFixed(2)
          : "0.00",
    };
  }
}

export default MockOpenCodeTools;
