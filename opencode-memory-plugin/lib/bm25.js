/**
 * BM25 Search Algorithm Implementation
 * 
 * BM25 (Best Matching 25) is a probabilistic ranking function 
 * used for information retrieval. It improves upon simple term 
 * frequency by considering:
 * - Term Frequency (TF): How often a term appears in a document
 * - Inverse Document Frequency (IDF): How rare/important a term is
 * - Document Length Normalization: Penalizes very long documents
 */

/**
 * BM25 parameters
 */
const BM25_K1 = 1.2;  // Term frequency saturation parameter
const BM25_B = 0.75;  // Document length normalization parameter

/**
 * BM25 Index for a collection of documents
 */
export class BM25Index {
  constructor() {
    this.documents = new Map();  // docId -> { content, tokens, length }
    this.docCount = 0;
    this.avgDocLength = 0;
    this.termDocFreq = new Map();  // term -> number of docs containing term
    this.totalDocLengths = 0;
  }

  /**
   * Tokenize text into terms
   * @param {string} text - Text to tokenize
   * @returns {string[]} Array of terms
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 1);
  }

  /**
   * Add a document to the index
   * @param {string} id - Document ID
   * @param {string} content - Document content
   * @param {Object} metadata - Additional metadata
   */
  addDocument(id, content, metadata = {}) {
    const tokens = this.tokenize(content);
    const termFreq = new Map();
    
    // Calculate term frequencies for this document
    for (const term of tokens) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    // Update global term document frequencies
    for (const term of termFreq.keys()) {
      this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);
    }

    // Store document
    const doc = {
      id,
      content,
      tokens,
      length: tokens.length,
      termFreq,
      metadata
    };

    this.documents.set(id, doc);
    this.docCount++;
    this.totalDocLengths += tokens.length;
    this.avgDocLength = this.totalDocLengths / this.docCount;
  }

  /**
   * Remove a document from the index
   * @param {string} id - Document ID
   */
  removeDocument(id) {
    const doc = this.documents.get(id);
    if (!doc) return;

    // Update term document frequencies
    for (const term of doc.termFreq.keys()) {
      const count = this.termDocFreq.get(term) || 0;
      if (count <= 1) {
        this.termDocFreq.delete(term);
      } else {
        this.termDocFreq.set(term, count - 1);
      }
    }

    // Update totals
    this.totalDocLengths -= doc.length;
    this.docCount--;
    this.documents.delete(id);
    
    if (this.docCount > 0) {
      this.avgDocLength = this.totalDocLengths / this.docCount;
    } else {
      this.avgDocLength = 0;
    }
  }

  /**
   * Clear the entire index
   */
  clear() {
    this.documents.clear();
    this.termDocFreq.clear();
    this.docCount = 0;
    this.totalDocLengths = 0;
    this.avgDocLength = 0;
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term
   * @param {string} term - Term to calculate IDF for
   * @returns {number} IDF score
   */
  calculateIDF(term) {
    const n = this.termDocFreq.get(term) || 0;
    const N = this.docCount;
    
    // BM25 IDF formula
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }

  /**
   * Calculate BM25 score for a document given query terms
   * @param {Object} doc - Document object
   * @param {string[]} queryTerms - Query terms
   * @returns {number} BM25 score
   */
  calculateBM25Score(doc, queryTerms) {
    let score = 0;
    const k1 = BM25_K1;
    const b = BM25_B;
    const docLength = doc.length;
    const avgdl = this.avgDocLength || 1;

    for (const term of queryTerms) {
      const tf = doc.termFreq.get(term) || 0;
      if (tf === 0) continue;

      const idf = this.calculateIDF(term);
      
      // BM25 formula
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgdl));
      
      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Search for documents matching the query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array<{id, score, content, metadata}>} Ranked results
   */
  search(query, options = {}) {
    const { limit = 10, minScore = 0.1 } = options;
    const queryTerms = this.tokenize(query);

    if (queryTerms.length === 0) {
      return [];
    }

    const results = [];

    for (const [id, doc] of this.documents) {
      const score = this.calculateBM25Score(doc, queryTerms);
      
      if (score >= minScore) {
        results.push({
          id: doc.id,
          score,
          content: doc.content,
          metadata: doc.metadata
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Get index statistics
   * @returns {Object} Index stats
   */
  getStats() {
    return {
      documentCount: this.docCount,
      averageDocumentLength: Math.round(this.avgDocLength * 100) / 100,
      uniqueTerms: this.termDocFreq.size,
      totalTokens: this.totalDocLengths
    };
  }

  /**
   * Search with diagnostic information
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Results with diagnostic data
   */
  searchWithDiagnostics(query, options = {}) {
    const { limit = 10, minScore = 0.1 } = options;
    const queryTerms = this.tokenize(query);

    const diagnostics = {
      query,
      queryTerms,
      totalDocs: this.docCount,
      minScore,
      scoreDistribution: {},
      idfStats: {},
      processingTime: 0
    };

    const startTime = Date.now();

    if (queryTerms.length === 0) {
      diagnostics.processingTime = Date.now() - startTime;
      return { results: [], diagnostics };
    }

    // Calculate IDF stats for query terms
    for (const term of queryTerms) {
      const idf = this.calculateIDF(term);
      const docFreq = this.termDocFreq.get(term) || 0;
      diagnostics.idfStats[term] = { idf, docFreq };
    }

    const results = [];
    const allScores = [];

    for (const [id, doc] of this.documents) {
      const score = this.calculateBM25Score(doc, queryTerms);
      allScores.push(score);
      
      if (score >= minScore) {
        results.push({
          id: doc.id,
          score,
          content: doc.content,
          metadata: doc.metadata
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Calculate score distribution statistics
    diagnostics.scoreDistribution = {
      count: allScores.length,
      min: Math.min(...allScores),
      max: Math.max(...allScores),
      mean: allScores.reduce((a, b) => a + b, 0) / allScores.length,
      aboveThreshold: results.length
    };

    // Calculate percentiles if there are scores
    if (allScores.length > 0) {
      const sorted = [...allScores].sort((a, b) => a - b);
      const getPercentile = (p) => {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
      };
      diagnostics.scoreDistribution.percentiles = {
        p25: getPercentile(25),
        p50: getPercentile(50),
        p75: getPercentile(75),
        p90: getPercentile(90),
        p95: getPercentile(95),
        p99: getPercentile(99)
      };
    }

    diagnostics.processingTime = Date.now() - startTime;

    return {
      results: results.slice(0, limit),
      diagnostics
    };
  }

}

/**
 * Create a BM25 index from an array of documents
 * @param {Array<{id, content, metadata}>} documents - Documents to index
 * @returns {BM25Index} Populated index
 */
export function createBM25Index(documents) {
  const index = new BM25Index();
  
  for (const doc of documents) {
    index.addDocument(doc.id, doc.content, doc.metadata || {});
  }
  
  return index;
}

/**
 * Quick BM25 search helper - creates index, searches, returns results
 * @param {string} query - Search query
 * @param {Array<{id, content, metadata}>} documents - Documents to search
 * @param {Object} options - Search options
 * @returns {Array<{id, score, content, metadata}>} Ranked results
 */
export function bm25Search(query, documents, options = {}) {
  const index = createBM25Index(documents);
  return index.search(query, options);
}

export default BM25Index;

