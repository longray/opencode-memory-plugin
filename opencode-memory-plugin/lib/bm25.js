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
const BM25_K1 = 1.2;
const BM25_B = 0.75;

export class BM25Index {
  constructor(options = {}) {
    this.k1 = options.k1 ?? BM25_K1;
    this.b = options.b ?? BM25_B;
    this.documents = new Map();
    this.docCount = 0;
    this.avgDocLength = 0;
    this.termDocFreq = new Map();
    this.totalDocLengths = 0;
  }

  /**
   * Tokenize text into terms with Chinese support
   * @param {string} text - Text to tokenize
   * @returns {string[]} Array of terms
   */
  tokenize(text) {
    const lowerText = text.toLowerCase();
    const tokens = [];

    const englishParts = lowerText.match(/[a-z0-9]+/g) || [];
    tokens.push(...englishParts.filter(w => w.length > 1));

    const chineseText = lowerText.replace(/[^\u4e00-\u9fa5]/g, '');

    const techTerms = [
      '错误处理',
      '异步编程',
      '并发控制',
      '响应式',
      '组件化',
      '背压',
      '双工',
      '管道',
      '生命周期',
      '状态管理',
      '分支管理',
      '错误传播',
      '流式处理',
      '代码分析',
    ];

    let remaining = chineseText;
    for (const term of techTerms.sort((a, b) => b.length - a.length)) {
      const regex = new RegExp(term, 'g');
      const matches = remaining.match(regex);
      if (matches) {
        tokens.push(...matches);
        remaining = remaining.replace(regex, '');
      }
    }

    const bigrams = [];
    for (let i = 0; i < remaining.length - 1; i++) {
      bigrams.push(remaining.substring(i, i + 2));
    }
    tokens.push(...bigrams);

    return tokens;
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
      metadata,
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
    const k1 = this.k1;
    const b = this.b;
    const docLength = doc.length;
    const avgdl = this.avgDocLength || 1;

    for (const term of queryTerms) {
      const tf = doc.termFreq.get(term) || 0;
      if (tf === 0) continue;

      const idf = this.calculateIDF(term);

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

    for (const [_id, doc] of this.documents) {
      const score = this.calculateBM25Score(doc, queryTerms);

      if (score >= minScore) {
        results.push({
          id: doc.id,
          score,
          content: doc.content,
          metadata: doc.metadata,
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
      totalTokens: this.totalDocLengths,
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
