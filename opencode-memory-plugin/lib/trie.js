/**
 * Trie (Prefix Tree) Data Structure Implementation
 *
 * Used for fast keyword matching and autocomplete suggestions.
 * Time Complexity:
 * - Insert: O(m) where m is the length of the word
 * - Search: O(m) where m is the length of the prefix
 * - Space: O(ALPHABET_SIZE * N * M) where N is number of keys, M is avg key length
 */

/**
 * Trie Node - represents a single character in the tree
 */
class TrieNode {
  constructor() {
    // Map of character -> TrieNode
    this.children = new Map();

    // Flag indicating if this node marks the end of a complete word
    this.isEndOfWord = false;

    // Set of entry IDs associated with this word
    // Supports multiple entries with the same keyword
    this.entryIds = new Set();

    // Frequency counter for ranking suggestions
    this.frequency = 0;
  }
}

/**
 * Trie - Prefix tree for efficient string matching
 */
export class Trie {
  constructor() {
    this.root = new TrieNode();
    this.size = 0; // Number of unique words inserted
  }

  /**
   * Insert a word into the trie with associated entry ID
   * @param {string} word - The word to insert
   * @param {string} entryId - The entry ID associated with this word
   * @param {number} frequency - Optional frequency for ranking (default: 1)
   */
  insert(word, entryId, frequency = 1) {
    if (!word || typeof word !== 'string') {
      return;
    }

    const lowerWord = word.toLowerCase().trim();
    if (lowerWord.length === 0) {
      return;
    }

    let current = this.root;

    for (const char of lowerWord) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
    }

    // Mark end of word
    if (!current.isEndOfWord) {
      current.isEndOfWord = true;
      this.size++;
    }

    // Associate entry ID
    current.entryIds.add(entryId);
    current.frequency += frequency;
  }

  /**
   * Search for all entry IDs matching a prefix
   * @param {string} prefix - The prefix to search for
   * @returns {Set<string>} Set of entry IDs
   */
  search(prefix) {
    if (!prefix || typeof prefix !== 'string') {
      return new Set();
    }

    const lowerPrefix = prefix.toLowerCase().trim();
    if (lowerPrefix.length === 0) {
      return this.getAllEntryIds();
    }

    // Find the node corresponding to the prefix
    const node = this._findNode(lowerPrefix);
    if (!node) {
      return new Set();
    }

    // Collect all entry IDs from this node and its children
    const entryIds = new Set();
    this._collectEntryIds(node, entryIds);

    return entryIds;
  }

  /**
   * Get autocomplete suggestions for a prefix
   * @param {string} prefix - The prefix to complete
   * @param {number} limit - Maximum number of suggestions (default: 10)
   * @returns {Array<{word: string, entryIds: string[], frequency: number}>}
   */
  getSuggestions(prefix, limit = 10) {
    if (!prefix || typeof prefix !== 'string') {
      return [];
    }

    const lowerPrefix = prefix.toLowerCase().trim();
    if (lowerPrefix.length === 0) {
      return [];
    }

    // Find the node corresponding to the prefix
    const node = this._findNode(lowerPrefix);
    if (!node) {
      return [];
    }

    // Collect all words starting with this prefix
    const suggestions = [];
    this._collectWords(node, lowerPrefix, suggestions);

    // Sort by frequency (descending) and limit results
    return suggestions.sort((a, b) => b.frequency - a.frequency).slice(0, limit);
  }

  /**
   * Delete a word-entry association from the trie
   * @param {string} word - The word to delete
   * @param {string} entryId - The specific entry ID to remove
   * @returns {boolean} True if deleted, false otherwise
   */
  delete(word, entryId) {
    if (!word || typeof word !== 'string') {
      return false;
    }

    const lowerWord = word.toLowerCase().trim();
    if (lowerWord.length === 0) {
      return false;
    }

    const node = this._findNode(lowerWord);
    if (!node || !node.isEndOfWord) {
      return false;
    }

    // Remove specific entry ID
    const hadEntry = node.entryIds.has(entryId);
    node.entryIds.delete(entryId);

    // If no more entries for this word, mark as not end of word
    if (node.entryIds.size === 0) {
      node.isEndOfWord = false;
      this.size--;
    }

    return hadEntry;
  }

  /**
   * Check if a word exists in the trie
   * @param {string} word - The word to check
   * @returns {boolean}
   */
  contains(word) {
    if (!word || typeof word !== 'string') {
      return false;
    }

    const node = this._findNode(word.toLowerCase().trim());
    return node !== null && node.isEndOfWord;
  }

  /**
   * Get statistics about the trie
   * @returns {{size: number, totalEntryIds: number, nodeCount: number}}
   */
  getStats() {
    let nodeCount = 0;
    let totalEntryIds = 0;

    // Iterative traversal to avoid stack overflow on large tries
    const stack = [this.root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;
      nodeCount++;
      totalEntryIds += node.entryIds.size;
      for (const child of node.children.values()) {
        stack.push(child);
      }
    }

    return {
      size: this.size,
      totalEntryIds,
      nodeCount,
    };
  }

  /**
   * Clear all data from the trie
   */
  clear() {
    this.root = new TrieNode();
    this.size = 0;
  }

  /**
   * Serialize trie to JSON for persistence
   * @returns {object}
   */
  serialize() {
    const serializeNode = node => {
      const children = {};
      for (const [char, childNode] of node.children) {
        children[char] = serializeNode(childNode);
      }
      return {
        isEndOfWord: node.isEndOfWord,
        entryIds: Array.from(node.entryIds),
        frequency: node.frequency,
        children,
      };
    };

    return {
      root: serializeNode(this.root),
      size: this.size,
    };
  }

  /**
   * Deserialize trie from JSON
   * @param {object} data - Serialized trie data
   * @returns {Trie}
   */
  static deserialize(data) {
    const trie = new Trie();
    trie.size = data.size || 0;

    const deserializeNode = nodeData => {
      const node = new TrieNode();
      node.isEndOfWord = nodeData.isEndOfWord;
      node.entryIds = new Set(nodeData.entryIds || []);
      node.frequency = nodeData.frequency || 0;

      for (const [char, childData] of Object.entries(nodeData.children || {})) {
        node.children.set(char, deserializeNode(childData));
      }

      return node;
    };

    trie.root = deserializeNode(data.root);
    return trie;
  }

  // ==================== Private Methods ====================

  /**
   * Find the node corresponding to a prefix
   * @private
   */
  _findNode(prefix) {
    let current = this.root;

    for (const char of prefix) {
      if (!current.children.has(char)) {
        return null;
      }
      current = current.children.get(char);
    }

    return current;
  }

  /**
   * Collect all entry IDs from a node and its children
   * @private
   */
  _collectEntryIds(node, entryIds) {
    if (!node) return;

    const stack = [node];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const entryId of current.entryIds) {
        entryIds.add(entryId);
      }
      for (const child of current.children.values()) {
        stack.push(child);
      }
    }
  }

  /**
   * Collect all complete words from a node
   * @private
   */
  _collectWords(node, prefix, words) {
    if (!node) return;

    // If this node marks the end of a word, add it
    if (node.isEndOfWord) {
      words.push({
        word: prefix,
        entryIds: Array.from(node.entryIds),
        frequency: node.frequency,
      });
    }

    // Recursively collect from children
    for (const [char, child] of node.children) {
      this._collectWords(child, prefix + char, words);
    }
  }

  /**
   * Get all entry IDs in the trie
   * @private
   */
  _getAllEntryIds() {
    const entryIds = new Set();
    this._collectEntryIds(this.root, entryIds);
    return entryIds;
  }
}

export default Trie;
