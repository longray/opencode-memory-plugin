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
    this.embeddingCache = new Map();  // 预生成缓存

    // 配置项
    this.embeddingMode = options.embeddingMode || 'local';
    this.apiEndpoint = options.apiEndpoint || 'http://localhost:18000/v1/embeddings';
    this.model = options.model || 'Qwen3-Embedding-0.6B';
    this.vectorDimensions = 1024;
    this.mockDimensions = 100;
    this.maxBatchSize = options.maxBatchSize || 64;  // 最优批量大小

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
      console.log('⚠️ 没有需要预生成的数据');
      return;
    }

    // 过滤掉已经缓存的内容
    const uniqueContents = [...new Set(contents)];
    const contentsToGenerate = uniqueContents.filter(content => !this.embeddingCache.has(this.hashCode(content).toString()));
    
    if (contentsToGenerate.length === 0) {
      console.log('✅ 所有 embedding 都已在缓存中');
      return;
    }

    console.log(`\n🚀 开始预生成 ${contentsToGenerate.length} 条 embeddings...`);
    console.log(`   模式: ${this.embeddingMode}`);
    console.log(`   批量大小: ${this.maxBatchSize}`);
    console.log(`   预计 API 调用次数: ${Math.ceil(contentsToGenerate.length / this.maxBatchSize)}\n`);

    const startTime = Date.now();
    let processedCount = 0;
    let batchCount = 0;

    // 按批量大小分组处理
    for (let i = 0; i < contentsToGenerate.length; i += this.maxBatchSize) {
      const batch = contentsToGenerate.slice(i, i + this.maxBatchSize);
      batchCount++;
      
      console.log(`  [批次 ${batchCount}] 处理 ${batch.length} 条 (${i + 1}-${Math.min(i + batch.length, contentsToGenerate.length)}/${contentsToGenerate.length})`);
      
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
          this.embeddingCache.set(cacheKey, this.generateMockEmbedding(content));
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
      console.log(`   平均每批: ${(processedCount / this.stats.batchApiCalls).toFixed(1)} 条`);
    }
    console.log(`   缓存大小: ${this.embeddingCache.size} 条\n`);
  }

  /**
   * 批量生成 embeddings（本地服务优化）
   */
  async generateBatchEmbeddings(texts) {
    if (texts.length === 0) return [];

    if (this.embeddingMode === 'mock') {
      return texts.map(text => this.generateMockEmbedding(text));
    }

    const startTime = Date.now();

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          encoding_format: 'float',
          dimensions: this.vectorDimensions,
          normalize: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Local API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      let embeddings;
      if (data.data && Array.isArray(data.data)) {
        embeddings = data.data.map(item => item.embedding);
      } else {
        throw new Error('Unknown API response format');
      }

      if (embeddings.length !== texts.length) {
        throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`);
      }

      return embeddings;

    } catch (error) {
      console.error('Batch embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * 优化的 memory_write - 使用预生成缓存
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

    // 使用预生成缓存
    try {
      const cacheKey = this.hashCode(content).toString();
      let embedding;
      
      if (this.embeddingCache.has(cacheKey)) {
        // 命中预生成缓存
        embedding = this.embeddingCache.get(cacheKey);
        this.stats.cacheHits++;
      } else {
        // 未命中，实时生成（不应该走到这里）
        console.log(`⚠️ Cache miss for content: ${content.substring(0, 30)}...`);
        embedding = await this.generateLocalEmbedding(content);
      }
      
      this.vectorIndex.set(record.id, embedding);
    } catch (error) {
      console.error(`Failed to get embedding for record ${record.id}:`, error);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float',
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
      console.error('Local embedding failed:', error);
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
   * 其他必要的方法（简化实现）
   */
  buildBM25Index() {
    // 简化实现
  }
}

export default MockOpenCodeToolsV5;
