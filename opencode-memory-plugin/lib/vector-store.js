/**
 * Vector Store Module for OpenCode Memory Plugin
 * 
 * Provides real semantic search using:
 * - External embedding service API (localhost:18000)
 * - sqlite-vec for vector storage
 * - better-sqlite3 for database
 * - BM25 for fallback keyword search
 */

import Database from 'better-sqlite3';
import { load as loadVec } from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import { BM25Index, createBM25Index } from './bm25.js';
import Database from 'better-sqlite3';
import { load as loadVec } from 'sqlite-vec';
import fs from 'fs';
import path from 'path';
import { BM25Index, createBM25Index } from './bm25.js';
const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const VECTOR_DB = path.join(MEMORY_DIR, 'vector-index.db');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

// Default values for external service
const DEFAULT_MODEL = 'external-api-service';
let DEFAULT_DIMENSIONS = 384; // Will be updated dynamically

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
    this.externalEndpoint = 'http://localhost:18000/embeddings'; // Default endpoint
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
    
    this.config = this.config || { embedding: { enabled: true } };
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

    // Set model from config or options
    this.modelName = options.model || config.embedding?.model || DEFAULT_MODEL;
    this.dimensions = this.getModelDimensions(this.modelName);

    try {
      // Initialize database
      await this.initDatabase();
      
      // Load embedding model
      await this.loadModel(options.forceReload);
      
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
    
    // Create vector table if not exists
    this.db.exec(`
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
    `);
    
    // Create vector table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        embedding float[${this.dimensions}]
      )
    `);
    
    // Create indexes for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_file);
      CREATE INDEX IF NOT EXISTS idx_documents_chunk ON documents(source_file, chunk_index);
    `);
  }

  /**
   * Load the embedding model
   */
  async loadModel(forceReload = false) {
    if (this.extractor && !forceReload) {
      return;
    }

    const config = this.getConfig();
    const cacheDir = config.embedding?.cache?.directory || 
      path.join(HOME, '.cache', 'huggingface');

    // Create feature extraction pipeline
    try {
      this.extractor = await pipeline('feature-extraction', this.modelName, {
        cache_dir: cacheDir,
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            console.log(`Loading model: ${progress.file} (${Math.round(progress.progress || 0)}%)`);
          }
        }
      });
    } catch (error) {
      console.error('Failed to load embedding model:', error.message);
      // Model loading failed, but we can still use keyword search
      this.extractor = null;
    }
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
    } else {
      for (const text of textArray) {
        const output = await this.extractor(text, {
          pooling: 'mean',
          normalize: true
        });
        
        // Convert to regular array
        embeddings.push(Array.from(output.data));
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
        // Fallback to keyword search
        return this.keywordSearch(query, options);
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
   * Hybrid search (vector + keyword)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async hybridSearch(query, options = {}) {
    const { 
      limit = 10, 
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      sourceFile = null
    } = options;

    // Get vector search results
    const vectorResults = await this.search(query, { 
      limit: limit * 2, 
      threshold: 0.8,
      sourceFile 
    });

    // Get keyword search results
    const keywordResults = this.keywordSearch(query, { 
      limit: limit * 2,
      sourceFile 
    });

    // Combine scores
    const combined = new Map();
    
    for (const r of vectorResults) {
      combined.set(r.id, { 
        ...r, 
        vectorScore: r.score, 
        keywordScore: 0 
      });
    }
    
    for (const r of keywordResults) {
      if (combined.has(r.id)) {
        combined.get(r.id).keywordScore = r.score;
      } else {
        combined.set(r.id, { 
          ...r, 
          vectorScore: 0, 
          keywordScore: r.score 
        });
      }
    }

    // Calculate hybrid score
    const results = Array.from(combined.values()).map(r => ({
      ...r,
      score: r.vectorScore * vectorWeight + r.keywordScore * keywordWeight
    }));

    // Sort by hybrid score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * BM25 search (keyword-based with TF-IDF scoring)
   * Falls back from vector search when embedding model is unavailable
   */
  bm25Search(query, options = {}) {
    const { limit = 10, sourceFile = null } = options;
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    
    if (terms.length === 0) {
      return [];
    }

    // Get all documents for BM25 indexing
    let sql = `SELECT id, content, source_file, line_number FROM documents`;
    const params = [];
    
    if (sourceFile) {
      sql += ` WHERE source_file = ?`;
      params.push(sourceFile);
    }

    const docs = this.db.prepare(sql).all(...params);
    
    if (docs.length === 0) {
      return [];
    }

    // Create BM25 index from documents
    const documents = docs.map(d => ({
      id: d.id,
      content: d.content,
      metadata: { source: d.source_file, line: d.line_number }
    }));
    
    const index = createBM25Index(documents);
    const results = index.search(query, { limit, minScore: 0.01 });
    
    return results.map(r => ({
      id: r.id,
      content: r.content,
      source: r.metadata.source,
      line: r.metadata.line,
      score: Math.min(1, r.score / 10)  // Normalize score to 0-1 range
    }));
  }

  /**
   * Legacy keyword search (kept for compatibility)
   * @deprecated Use bm25Search instead
   */
  keywordSearch(query, options = {}) {
    return this.bm25Search(query, options);
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
      lastIndexed: metadata?.last_indexed || null,
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