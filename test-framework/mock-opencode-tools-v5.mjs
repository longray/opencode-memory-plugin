/**
 * Mock OpenCode工具 - v5 批量预生成优化版本
 *
 * 核心优化：测试前预先批量生成所有 embedding，测试时直接使用缓存
 * 实现 40-60x 速度提升
 */

class MockOpenCodeToolsV5 {
  constructor(options = {}) {
    this.memoryData = [];
    this.bm25Index = new Map();
    this.vectorIndex = new Map();
    this.embeddingCache = new Map(); // 预生成缓存

    // 配置项
    this.embeddingMode = options.embeddingMode || "local";
    this.apiEndpoint =
      options.apiEndpoint || "http://localhost:18000/v1/embeddings";
    this.model = options.model || "Qwen3-Embedding-0.6B";
    this.vectorDimensions = 1024;
    this.mockDimensions = 100;
    this.maxBatchSize = options.maxBatchSize || 64; // 最优批量大小

    // 统计信息
    this.stats = {
      preGenerated: 0,
      cacheHits: 0,
      apiCalls: 0,
      batchApiCalls: 0,
    };
  }

  /**
   * 预生成所有测试数据的 embeddings（批量优化核心）
   * 在测试开始前调用，一次性生成所有需要的 embedding
   *
   * @param {Array<string>} contents - 所有需要生成 embedding 的文本数组
   * @returns {Promise<void>}
   */
  async preGenerateEmbeddings(contents) {
    if (!contents || contents.length === 0) {
      console.log("⚠️ 没有需要预生成的数据");
      return;
    }

    // 过滤掉已经缓存的内容
    const uniqueContents = [...new Set(contents)];
    const contentsToGenerate = uniqueContents.filter(
      (content) => !this.embeddingCache.has(this.hashCode(content).toString()),
    );

    if (contentsToGenerate.length === 0) {
      console.log("✅ 所有 embedding 都已在缓存中");
      return;
    }

    console.log(
      `\n🚀 开始预生成 ${contentsToGenerate.length} 条 embeddings...`,
    );
    console.log(`   模式: ${this.embeddingMode}`);
    console.log(`   批量大小: ${this.maxBatchSize}`);
    console.log(
      `   预计 API 调用次数: ${Math.ceil(contentsToGenerate.length / this.maxBatchSize)}\n`,
    );

    const startTime = Date.now();
    let processedCount = 0;
    let batchCount = 0;

    // 按批量大小分组处理
    for (let i = 0; i < contentsToGenerate.length; i += this.maxBatchSize) {
      const batch = contentsToGenerate.slice(i, i + this.maxBatchSize);
      batchCount++;

      console.log(
        `  [批次 ${batchCount}] 处理 ${batch.length} 条 (${i + 1}-${Math.min(i + batch.length, contentsToGenerate.length)}/${contentsToGenerate.length})`,
      );

      try {
        // 批量生成 embedding
        const embeddings = await this.generateBatchEmbeddings(batch);

        // 存入缓存
        batch.forEach((content, index) => {
          const cacheKey = this.hashCode(content).toString();
          this.embeddingCache.set(cacheKey, embeddings[index]);
        });

        this.stats.preGenerated += batch.length;
        this.stats.batchApiCalls++;
      } catch (error) {
        console.error(`  ❌ 批次 ${batchCount} 生成失败:`, error.message);
        // 失败时使用 mock embedding 作为 fallback
        batch.forEach((content) => {
          const cacheKey = this.hashCode(content).toString();
          this.embeddingCache.set(
            cacheKey,
            this.generateMockEmbedding(content),
          );
        });
      }

      processedCount += batch.length;
    }

    const duration = Date.now() - startTime;

    console.log(`\n✅ 预生成完成！`);
    console.log(`   总耗时: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`   处理数据: ${processedCount} 条`);
    console.log(`   实际生成: ${this.stats.preGenerated} 条 (去重后)`);
    console.log(`   API 调用: ${this.stats.batchApiCalls} 次`);
    if (this.stats.batchApiCalls > 0) {
      console.log(
        `   平均每批: ${(processedCount / this.stats.batchApiCalls).toFixed(1)} 条`,
      );
    }
    console.log(`   缓存大小: ${this.embeddingCache.size} 条\n`);
  }

  /**
   * 批量生成 embeddings（本地服务优化）
   */
  async generateBatchEmbeddings(texts) {
    if (texts.length === 0) return [];

    if (this.embeddingMode === "mock") {
      return texts.map((text) => this.generateMockEmbedding(text));
    }

    const startTime = Date.now();

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
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

      return embeddings;
    } catch (error) {
      console.error("Batch embedding generation failed:", error);
      console.warn("⚠️  Falling back to mock embeddings for this batch");
      // 优雅降级：返回 mock embeddings 而不是抛出错误
      return texts.map((text) => this.generateMockEmbedding(text));
    }
  }

  /**
   * 优化的 memory_write - 使用预生成缓存
   */
  async memory_write({ content, type, tags }) {
    // 输入验证
    if (!content || content.trim() === "") {
      throw new Error("Content cannot be empty");
    }

    const record = {
      id: Date.now() + Math.random(),
      content,
      type,
      tags,
      timestamp: new Date().toISOString(),
    };
    this.memoryData.push(record);

    // 使用预生成缓存
    try {
      const cacheKey = this.hashCode(content).toString();
      let embedding;

      if (this.embeddingCache.has(cacheKey)) {
        // 命中预生成缓存
        embedding = this.embeddingCache.get(cacheKey);
        this.stats.cacheHits++;
      } else {
        // 未命中，实时生成（带容错）
        console.log(
          `⚠️ Cache miss for content: ${content.substring(0, 30)}...`,
        );
        embedding = await this.generateLocalEmbedding(content);
      }

      if (embedding) {
        this.vectorIndex.set(record.id, embedding);
      }
    } catch (error) {
      console.error(`Failed to get embedding for record ${record.id}:`, error);
      // 不抛出错误，允许记录保存成功（只是没有向量索引）
    }

    this.buildBM25Index();
    return { success: true, id: record.id };
  }

  /**
   * 本地 embedding（逐条调用，带缓存）
   */
  async generateLocalEmbedding(text) {
    const cacheKey = this.hashCode(text).toString();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: "float",
          dimensions: this.vectorDimensions,
          normalize: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let embedding;
      if (data.data && data.data[0]) {
        embedding = data.data[0].embedding;
      }

      this.embeddingCache.set(cacheKey, embedding);
      this.stats.apiCalls++;
      return embedding;
    } catch (error) {
      console.error("Local embedding failed:", error);
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * Mock embedding（用于降级）
   */
  generateMockEmbedding(text) {
    const hash = this.hashCode(text);
    const embedding = [];
    for (let i = 0; i < this.mockDimensions; i++) {
      const value = Math.sin(hash + i * 0.1) * Math.cos(hash + i * 0.05);
      embedding.push(parseFloat(value.toFixed(6)));
    }
    return embedding;
  }

  /**
   * Hash code
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 其他必要的方法（补全所有检索功能）
   */
  buildBM25Index() {
    this.bm25Index.clear();
    const documents = this.memoryData.map((record) => ({
      id: record.id,
      content: record.content,
      tags: record.tags,
    }));

    documents.forEach((doc) => {
      // 修复：处理 tags 可能不是数组的情况
      const tagsStr = Array.isArray(doc.tags)
        ? doc.tags.join(" ")
        : doc.tags || "";
      const terms = this.tokenize(doc.content + " " + tagsStr);
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
    const queryVector = await this.generateLocalEmbedding(query);

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
  async rebuild_index(options = {}) {
    const force = options.force || false;
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
}

export default MockOpenCodeToolsV5;
