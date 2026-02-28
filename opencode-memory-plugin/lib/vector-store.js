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
    // 优先尝试公网服务，本地服务作为后备
    const publicEndpoints = [
      'https://api.openai.com/v1/embeddings',  // 示例公网服务，您需要配置实际的API密钥
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-embedding',  // 通义千问服务
    ];

    // 尝试公网服务
    for (const endpoint of publicEndpoints) {
      try {
        // 示例：调用OpenAI兼容API，您需要配置正确的API密钥
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': 'Bearer YOUR_API_KEY',  // 您需要在此处配置实际的API密钥
            // 'X-DashScope-SSE-Enable': 'disable',  // 如果使用通义千问
          },
          body: JSON.stringify({ 
            input: text,
            model: 'text-embedding-ada-002'  // 根据您使用的公网服务调整模型名称
          })
        });

        if (response.ok) {
          const data = await response.json();

          // 处理公网服务的不同响应格式
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
        } else {
          console.log(`Public service failed: ${response.status} ${await response.text()}`);
        }
      } catch (error) {
        console.log(`Public service endpoint ${endpoint} failed:`, error.message);
        // 继续试下一个公网端点
      }
    }

    // 如果公网服务都失败了，尝试本地服务
    console.log('All public services failed, falling back to local service');
    
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

    // 处理本地服务的响应格式
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
    
    throw new Error('Unexpected response format from either public or local embedding service');
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