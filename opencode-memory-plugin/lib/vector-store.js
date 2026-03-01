/**
 * Vector Store Module for OpenCode Memory Plugin
 * 
 * Provides real semantic search using:
 * - External embedding service API (localhost:18000/v1/embeddings)
 * - sqlite-vec for vector storage
 * - better-sqlite3 for database
 */

import Database from 'better-sqlite3';
import { load as loadVec } from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import { BM25Index } from './bm25.js';
import { rrfFusion, softMultiplicationFusion, dynamicWeightFusion } from './fusion-strategies.js';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const VECTOR_DB = path.join(MEMORY_DIR, 'vector-index.db');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

// Default values for external service
const DEFAULT_MODEL = 'external-api-service';
let DEFAULT_DIMENSIONS = 1024; // Updated to Qwen3 embedding dimension (will be updated dynamically)

/**
 * VectorStore class for managing embeddings and semantic search
 */
export class VectorStore {
  constructor() {
    this.db = null;
    // No local extractor since using external service
    this.modelName = DEFAULT_MODEL;
    this.dimensions = DEFAULT_DIMENSIONS;
    this.initialized = false;
    this.config = null;
    this.useExternalService = true;
    this.externalEndpoint = 'http://localhost:18000/v1/embeddings'; // Default endpoint for Qwen3 embedding service
  }

  /**
   * Get configuration
   */
  getConfig() {
    if (this.config) return this.config;
    
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        this.config = JSON.parse(content);
      }
    } catch (e) {
      // Ignore errors
    }
    
    this.config = this.config || { 
      embedding: { 
        enabled: true,
        provider: 'external',  // Changed to external API service
        endpoint: 'http://localhost:18000/v1/embeddings',  // Default embedding service endpoint for Qwen3
        model: 'local-embedding-model',  // Placeholder for external model
        fallbackMode: 'error',  // Throw error when external service unavailable
        cache: {
          enabled: false  // No caching for external service
        }
      } 
    };
    return this.config;
  }

  /**
   * Initialize the vector store
   * @param {Object} options - Initialization options
   * @param {string} options.model - Model name to use
   * @param {boolean} options.forceReload - Force reload the model
   */
  async initialize(options = {}) {
    const config = this.getConfig();
    
    if (!config.embedding?.enabled) {
      return {
        success: false,
        error: 'Embedding is disabled in configuration',
        fallback: true
      };
    }

    // Set service endpoint from config or options
    this.externalEndpoint = options.endpoint || config.embedding?.endpoint || 'http://localhost:18000/v1/embeddings';
    this.useExternalService = config.embedding?.provider === 'external';
    
    // Validate external service if enabled
    if (this.useExternalService) {
      try {
        // Test the endpoint with a small text
        const testEmbedding = await this.getExternalEmbedding('test');
        if (testEmbedding && Array.isArray(testEmbedding)) {
          this.dimensions = testEmbedding.length;
        } else {
          throw new Error('Invalid response from embedding service');
        }
      } catch (e) {
        console.error('Failed to connect to external embedding service:', e.message);
        return {
          success: false,
          error: `External embedding service not accessible: ${e.message}`,
          fallback: true
        };
      }
    }

    try {
      // Initialize database
      await this.initDatabase();
      
      this.initialized = true;
      
      return {
        success: true,
        model: this.modelName,
        dimensions: this.dimensions,
        indexedDocuments: this.getIndexedCount()
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        fallback: true
      };
    }
  }

  /**
   * Get dimensions for a model
   */
  getModelDimensions(modelName) {
    const modelDimensions = {
      'Xenova/all-MiniLM-L6-v2': 384,
      'Xenova/bge-small-en-v1.5': 384,
      'Xenova/bge-base-en-v1.5': 768,
      'Xenova/e5-small-v2': 384,
      'Xenova/nomic-embed-text-v1.5': 768
    };
    return modelDimensions[modelName] || DEFAULT_DIMENSIONS;
  }

  /**
   * Initialize SQLite database with sqlite-vec extension
   */
  async initDatabase() {
    // Ensure memory directory exists
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }

    // Open database
    this.db = new Database(VECTOR_DB);
    
    // Load sqlite-vec extension
    loadVec(this.db);
    
    // Define SQL string for creating tables
    const createTablesSql = `
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        source_file TEXT,
        line_number INTEGER,
        chunk_index INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS index_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        model_name TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        total_chunks INTEGER DEFAULT 0,
        last_indexed DATETIME,
        version TEXT DEFAULT '1.0'
      );
    `;    
    
    this.db.exec(createTablesSql);

    // Create vector table
    const createVectorTableSql = `
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        embedding float[${this.dimensions}]
      )
    `;
    this.db.exec(createVectorTableSql);
    
    // Create indexes for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_file);
      CREATE INDEX IF NOT EXISTS idx_documents_chunk ON documents(source_file, chunk_index);
    `);
  }

  /**
   * Get embedding from external service
   */
  async getExternalEmbedding(text) {
    // 优先尝试 ModelScope 公网 API（使用 MODELSCOPE_API_KEY），本地服务作为后备
    const apiKey = process.env.MODELSCOPE_API_KEY;
    
    if (apiKey) {
      try {
        const url = 'https://api-inference.modelscope.cn/v1/embeddings';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen3-Embedding-0.6B',
            input: text,
            encoding_format: 'float'
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          // ModelScope API 返回格式: { data: [{ embedding: [...] }] }
          if (data && data.data && Array.isArray(data.data) && data.data[0]) {
            if (Array.isArray(data.data[0].embedding)) {
              return data.data[0].embedding;
            } else if (Array.isArray(data.data[0])) {
              return data.data[0];
            }
          }
        } else {
          console.log(`ModelScope API failed: ${response.status} ${await response.text()}`);
        }
      } catch (error) {
        console.log(`ModelScope API request failed:`, error.message);
      }
    } else {
      console.log('MODELSCOPE_API_KEY not set, using local service only');
    }

    // 如果公網服務失敗或未配置，嘗試本地服務
    console.log('Falling back to local service at:', this.externalEndpoint);
    
    const response = await fetch(this.externalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        input: text,
        model: 'Qwen3-Embedding-0.6B',
        encoding_format: 'float',
        normalize: true
      })
    });

    if (!response.ok) {
      throw new Error(`Both public and local services failed: HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // 处理本地服務的響應格式
    if (data && data.data && Array.isArray(data.data)) {
      if (data.data[0] && Array.isArray(data.data[0].embedding)) {
        return data.data[0].embedding;
      } else if (Array.isArray(data.data[0])) {
        return data.data[0];
      }
    } else if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.embedding)) {
      return data.embedding;
    } else if (data && data.embeddings && Array.isArray(data.embeddings)) {
      return data.embeddings;
    }
    
    throw new Error('Unexpected response format from embedding service');
  }

  /**
   * Generate embeddings for text
   * @param {string|string[]} texts - Text or array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }
    
    if (!this.useExternalService) {
      if (!this.extractor) {
        throw new Error('Local model not initialized. Call initialize() first.');
      }
    }
    
    const textArray = Array.isArray(texts) ? texts : [texts];
    const embeddings = [];    
    if (this.useExternalService) {
      // Process each text separately to handle potential rate limiting or large payloads
      for (const text of textArray) {
        try {
          const embedding = await this.getExternalEmbedding(text);
          if (embedding.length !== this.dimensions) {
            throw new Error(`Dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`);
          }
          embeddings.push(embedding);
        } catch (error) {
          console.error('Error getting embedding for text:', error.message);
          throw error;
        }
      }
    }
    
    return embeddings;
  }

  /**
   * Split text into chunks for indexing
   * @param {string} text - Text to split
   * @param {number} chunkSize - Maximum chunk size
   * @param {number} overlap - Overlap between chunks
   * @returns {Array<{content: string, startLine: number, endLine: number}>}
   */
  chunkText(text, chunkSize = 400, overlap = 80) {
    const lines = text.split('\n');
    const chunks = [];
    
    let i = 0;
    while (i < lines.length) {
      const endLine = Math.min(i + chunkSize, lines.length);
      const content = lines.slice(i, endLine).join('\n');
      
      if (content.trim()) {
        chunks.push({
          content: content.trim(),
          startLine: i + 1,
          endLine: endLine,
          index: chunks.length
        });
      }
      
      i += (chunkSize - overlap);
    }
    
    return chunks;
  }

  /**
   * Index a document
   * @param {string} content - Document content
   * @param {string} sourceFile - Source file name
   * @param {Object} options - Indexing options
   */
  async indexDocument(content, sourceFile, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { chunkSize = 400, overlap = 80, clearExisting = false } = options;

    // Clear existing entries for this file
    if (clearExisting) {
      this.clearFileIndex(sourceFile);
    }

    // Split into chunks
    const chunks = this.chunkText(content, chunkSize, overlap);
    
    if (chunks.length === 0) {
      return { indexed: 0, source: sourceFile };
    }

    // Generate embeddings for all chunks
    const embeddings = await this.generateEmbeddings(chunks.map(c => c.content));

    // Begin transaction
    const insertDoc = this.db.prepare(`
      INSERT INTO documents (content, source_file, line_number, chunk_index)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertVec = this.db.prepare(`
      INSERT INTO vec_embeddings (rowid, embedding)
      VALUES (?, ?)
    `);

    this.db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        
        // Insert document
        const result = insertDoc.run(
          chunk.content,
          sourceFile,
          chunk.startLine,
          chunk.index
        );
        
        // Insert vector
        const vectorBlob = new Float32Array(embedding);
        insertVec.run(result.lastInsertRowid, vectorBlob);
      }
    })();

    // Update metadata
    this.updateMetadata();

    return {
      indexed: chunks.length,
      source: sourceFile
    };
  }

  /**
   * Clear index for a specific file
   */
  clearFileIndex(sourceFile) {
    // Get document IDs to delete from vector table
    const docs = this.db.prepare(`
      SELECT id FROM documents WHERE source_file = ?
    `).all(sourceFile);
    
    const ids = docs.map(d => d.id);
    
    if (ids.length > 0) {
      this.db.transaction(() => {
        // Delete from documents
        this.db.prepare('DELETE FROM documents WHERE source_file = ?').run(sourceFile);
        
        // Delete from vectors
        const placeholders = ids.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM vec_embeddings WHERE rowid IN (${placeholders})`).run(...ids);
      })();
    }
  }

  /**
   * Clear entire index
   */
  clearIndex() {
    this.db.exec(`
      DELETE FROM documents;
      DELETE FROM vec_embeddings;
      DELETE FROM index_metadata;
    `);
  }

  /**
   * Update metadata
   */
  updateMetadata() {
    const count = this.getIndexedCount();
    
    this.db.prepare(`
      INSERT OR REPLACE INTO index_metadata (id, model_name, dimensions, total_chunks, last_indexed)
      VALUES (1, ?, ?, ?, datetime('now'))
    `).run(this.modelName, this.dimensions, count);
  }

  /**
   * Get count of indexed documents
   */
  getIndexedCount() {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM documents').get();
    return result?.count || 0;
  }

  /**
   * Perform semantic search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array<{content: string, score: number, source: string}>>}
   */
  async search(query, options = {}) {
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        throw new Error('External embedding service not accessible');
      }
    }

    const { 
      limit = 10, 
      threshold = 0.5,
      sourceFile = null 
    } = options;

    // Generate query embedding
    const [queryEmbedding] = await this.generateEmbeddings([query]);
    const queryVector = new Float32Array(queryEmbedding);

    // Perform vector search
    let sql = `
      SELECT 
        d.id,
        d.content,
        d.source_file,
        d.line_number,
        v.distance
      FROM documents d
      JOIN vec_embeddings v ON d.id = v.rowid
      WHERE vec_distance_cosine(v.embedding, ?) < ?
    `;    
    const params = [queryVector, threshold];
    
    if (sourceFile) {
      sql += ` AND d.source_file = ?`;
      params.push(sourceFile);
    }
    
    sql += ` ORDER BY v.distance ASC LIMIT ?`;
    params.push(limit);

    const results = this.db.prepare(sql).all(...params);

    // Calculate similarity score (1 - distance for cosine)
    return results.map(r => ({
      id: r.id,
      content: r.content,
      source: r.source_file,
      line: r.line_number,
      score: 1 - r.distance,
      distance: r.distance
    }));
  }


  /**
   * Perform semantic search with diagnostic information
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Results with diagnostic data
   */
  async searchWithDiagnostics(query, options = {}) {
    const startTime = Date.now();
    
    if (!this.initialized) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        throw new Error('External embedding service not accessible');
      }
    }

    const { 
      limit = 10, 
      threshold = 0.5,
      sourceFile = null 
    } = options;

    const diagnostics = {
      query,
      threshold,
      limit,
      totalChunks: this.getIndexedCount(),
      processingTime: 0,
      scoreDistribution: {},
      embeddingTime: 0
    };

    // Generate query embedding
    const embedStart = Date.now();
    const [queryEmbedding] = await this.generateEmbeddings([query]);
    diagnostics.embeddingTime = Date.now() - embedStart;
    
    const queryVector = new Float32Array(queryEmbedding);

    // First, get all documents above threshold to analyze distribution
    let allSql = `
      SELECT 
        d.id,
        d.content,
        d.source_file,
        d.line_number,
        v.distance
      FROM documents d
      JOIN vec_embeddings v ON d.id = v.rowid
      WHERE vec_distance_cosine(v.embedding, ?) < ?
    `;
    const allParams = [queryVector, threshold];
    
    if (sourceFile) {
      allSql += ` AND d.source_file = ?`;
      allParams.push(sourceFile);
    }
    
    allSql += ` ORDER BY v.distance ASC`;

    const allResults = this.db.prepare(allSql).all(...allParams);
    
    // Calculate similarity scores and distribution
    const allScores = allResults.map(r => 1 - r.distance);
    
    if (allScores.length > 0) {
      const sorted = [...allScores].sort((a, b) => a - b);
      diagnostics.scoreDistribution = {
        count: allScores.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: allScores.reduce((a, b) => a + b, 0) / allScores.length,
        median: sorted[Math.floor(sorted.length / 2)],
        percentiles: {
          25: sorted[Math.floor(sorted.length * 0.25)],
          50: sorted[Math.floor(sorted.length * 0.50)],
          75: sorted[Math.floor(sorted.length * 0.75)],
          90: sorted[Math.floor(sorted.length * 0.90)],
          95: sorted[Math.floor(sorted.length * 0.95)],
          99: sorted[Math.floor(sorted.length * 0.99)]
        }
      };
    }

    // Get top results
    const topResults = allResults.slice(0, limit).map(r => ({
      id: r.id,
      content: r.content,
      source: r.source_file,
      line: r.line_number,
      score: 1 - r.distance,
      distance: r.distance
    }));

    diagnostics.processingTime = Date.now() - startTime;
    diagnostics.topResultsCount = topResults.length;

    return {
      results: topResults,
      diagnostics
    };
  }

  /**
   * Perform hybrid search using fusion strategies
   * @param {string} query - Search query
   * @param {Array} documents - Array of documents for BM25 indexing
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Fused search results
   */
  async hybridSearch(query, documents, options = {}) {
    const {
      limit = 10,
      vectorThreshold = 0.5,
      bm25MinScore = 0.1,
      fusionStrategy = 'rrf',
      fusionOptions = {}
    } = options;

    // Perform vector search
    const vectorResults = await this.search(query, {
      limit: limit * 2,
      threshold: vectorThreshold
    });

    // Perform BM25 search
    const { BM25Index } = await import('./bm25.js');
    const {
      softMultiplicationFusion,
      rrfFusion,
      dynamicWeightFusion
    } = await import('./fusion-strategies.js');

    const bm25Index = new BM25Index();
    documents.forEach(doc => bm25Index.addDocument(doc.id, doc.content, doc.metadata));

    const bm25Results = bm25Index.search(query, {
      limit: limit * 2,
      minScore: bm25MinScore
    });

    // Apply fusion strategy
    let fusedResults;
    switch (fusionStrategy) {
      case 'soft-multiplication':
        fusedResults = softMultiplicationFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
      case 'dynamic':
        fusedResults = dynamicWeightFusion(vectorResults, bm25Results, query, {
          limit,
          ...fusionOptions
        });
        break;
      case 'rrf':
      default:
        fusedResults = rrfFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
    }

    // Add fusion metadata
    return fusedResults.map(r => ({
      ...r,
      fusionStrategy,
      rawScores: {
        vector: r.vectorScore,
        bm25: r.bm25Score
      }
    }));
  }


  /**
   * Perform hybrid search using fusion strategies
   * @param {string} query - Search query
   * @param {Array} documents - Array of documents for BM25 indexing
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Fused search results
   */
  async hybridSearch(query, documents, options = {}) {
    // Phase 3: 从配置读取融合策略设置
    const config = this.getConfig();
    const fusionConfig = config.search?.fusion || {};
    const defaultStrategy = fusionConfig.strategy || 'rrf';
    const defaultFusionOptions = fusionConfig.options || {};
    
    const {
      limit = 10,
      vectorThreshold = 0.5,
      bm25MinScore = 0.1,
      fusionStrategy = defaultStrategy,
      fusionOptions = defaultFusionOptions[fusionStrategy] || {}
    } = options;
    // Phase 3: 读取配置文件中的融合策略设置
    const config = this.getConfig();
    const fusionConfig = config.search?.fusion || {};
    
    // 合并配置和选项（选项优先级更高）
    const strategyFromConfig = fusionConfig.strategy || 'rrf';
    const strategyOptions = fusionConfig.options?.[strategyFromConfig] || {};
    
    const {
      limit = 10,
      vectorThreshold = 0.5,
      bm25MinScore = 0.1,
      fusionStrategy = strategyFromConfig,
      fusionOptions = strategyOptions
    } = options;
    const {
      limit = 10,
      vectorThreshold = 0.5,
      bm25MinScore = 0.1,
      fusionStrategy = 'rrf',
      fusionOptions = {}
    } = options;

    // Perform vector search
    const vectorResults = await this.search(query, {
      limit: limit * 2,
      threshold: vectorThreshold
    });

    // Perform BM25 search
    const { BM25Index } = await import('./bm25.js');
    const {
      softMultiplicationFusion,
      rrfFusion,
      dynamicWeightFusion
    } = await import('./fusion-strategies.js');

    const bm25Index = new BM25Index();
    documents.forEach(doc => bm25Index.addDocument(doc.id, doc.content, doc.metadata));

    const bm25Results = bm25Index.search(query, {
      limit: limit * 2,
      minScore: bm25MinScore
    });

    // Apply fusion strategy
    let fusedResults;
    switch (fusionStrategy) {
      case 'soft-multiplication':
        fusedResults = softMultiplicationFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
      case 'dynamic':
        fusedResults = dynamicWeightFusion(vectorResults, bm25Results, query, {
          limit,
          ...fusionOptions
        });
        break;
      case 'rrf':
      default:
        fusedResults = rrfFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
    }

    // Add fusion metadata
    return fusedResults.map(r => ({
      ...r,
      fusionStrategy,
      rawScores: {
        vector: r.vectorScore,
        bm25: r.bm25Score
      }
    }));
  }


  /**
   * Perform hybrid search using fusion strategies
   * @param {string} query - Search query
   * @param {Array} documents - Array of documents for BM25 indexing
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Fused search results
   */
  async hybridSearch(query, documents, options = {}) {
    const {
      limit = 10,
      vectorThreshold = 0.5,
      bm25MinScore = 0.1,
      fusionStrategy = 'rrf',
      fusionOptions = {}
    } = options;

    // Perform vector search
    const vectorResults = await this.search(query, {
      limit: limit * 2,
      threshold: vectorThreshold
    });

    // Perform BM25 search
    const { BM25Index } = await import('./bm25.js');
    const {
      softMultiplicationFusion,
      rrfFusion,
      dynamicWeightFusion
    } = await import('./fusion-strategies.js');

    const bm25Index = new BM25Index();
    documents.forEach(doc => bm25Index.addDocument(doc.id, doc.content, doc.metadata));

    const bm25Results = bm25Index.search(query, {
      limit: limit * 2,
      minScore: bm25MinScore
    });

    // Apply fusion strategy
    let fusedResults;
    switch (fusionStrategy) {
      case 'soft-multiplication':
        fusedResults = softMultiplicationFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
      case 'dynamic':
        fusedResults = dynamicWeightFusion(vectorResults, bm25Results, query, {
          limit,
          ...fusionOptions
        });
        break;
      case 'rrf':
      default:
        fusedResults = rrfFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
    }

    // Add fusion metadata
    return fusedResults.map(r => ({
      ...r,
      fusionStrategy,
      rawScores: {
        vector: r.vectorScore,
        bm25: r.bm25Score
      }
    }));
  }


  /**
   * Get index status
   */
  getStatus() {
    const count = this.getIndexedCount();
    
    let metadata = null;
    try {
      metadata = this.db.prepare('SELECT * FROM index_metadata WHERE id = 1').get();
    } catch (e) {
      // Metadata doesn't exist yet
    }

    return {
      initialized: this.initialized,
      model: this.modelName,
      dimensions: this.dimensions,
      totalChunks: count,
      lastIndexed: metadata?.lastIndexed || null,
      dbPath: VECTOR_DB
    };
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  /**
   * Perform hybrid search using fusion strategies
   * @param {string} query - Search query
   * @param {Array} documents - Array of documents for BM25 indexing
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Fused search results
   */
  async hybridSearch(query, documents, options = {}) {
    const {
      limit = 10,
      vectorThreshold = 0.5,
      bm25MinScore = 0.1,
      fusionStrategy = 'rrf',  // 'rrf', 'soft-multiplication', 'dynamic'
      fusionOptions = {}
    } = options;

    // Perform vector search
    const vectorResults = await this.search(query, {
      limit: limit * 2,  // Get more results for better fusion
      threshold: vectorThreshold
    });

    // Perform BM25 search
    const { BM25Index } = await import('./bm25.js');
    const {
      softMultiplicationFusion,
      rrfFusion,
      dynamicWeightFusion
    } = await import('./fusion-strategies.js');

    const bm25Index = new BM25Index();
    documents.forEach(doc => bm25Index.addDocument(doc.id, doc.content, doc.metadata));

    const bm25Results = bm25Index.search(query, {
      limit: limit * 2,
      minScore: bm25MinScore
    });

    // Apply fusion strategy
    let fusedResults;
    switch (fusionStrategy) {
      case 'soft-multiplication':
        fusedResults = softMultiplicationFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
      case 'dynamic':
        fusedResults = dynamicWeightFusion(vectorResults, bm25Results, query, {
          limit,
          ...fusionOptions
        });
        break;
      case 'rrf':
      default:
        fusedResults = rrfFusion(vectorResults, bm25Results, {
          limit,
          ...fusionOptions
        });
        break;
    }

    // Add fusion metadata
    return fusedResults.map(r => ({
      ...r,
      fusionStrategy,
      rawScores: {
        vector: r.vectorScore,
        bm25: r.bm25Score
      }
    }));
  }

}

// Singleton instance
let vectorStoreInstance = null;

/**
 * Get or create vector store instance
 */
export function getVectorStore() {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
  }
  return vectorStoreInstance;
}

export default VectorStore;