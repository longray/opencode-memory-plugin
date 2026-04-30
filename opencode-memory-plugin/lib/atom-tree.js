/**
 * Atom tree algorithms for v3.3 Atom Architecture
 * Includes: buildAtomTree, flattenAtomTree, detectCircularReference, generateFractionalIndex
 */

/**
 * Build atom tree from flat array
 * O(n) time complexity
 * @param {Array} atoms - Flat array of atoms with local_id and parent_id
 * @param {boolean} includeContent - Whether to include content in nodes
 * @returns {Array} Tree structure with children
 */
export function buildAtomTree(atoms, includeContent = true) {
  if (!atoms || atoms.length === 0) {
    return [];
  }

  const map = new Map();
  const roots = [];

  // First pass: create node map
  for (const atom of atoms) {
    map.set(atom.local_id, {
      ...atom,
      content: includeContent ? atom.content : undefined,
      children: [],
    });
  }

  // Second pass: build parent-child relationships
  for (const atom of atoms) {
    const node = map.get(atom.local_id);
    if (!atom.parent_id) {
      roots.push(node);
    } else {
      const parent = map.get(atom.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Dangling parent_id - promote to root
        roots.push(node);
      }
    }
  }

  // Sort by order
  const sortByOrder = (nodes) => {
    nodes.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
    nodes.forEach((n) => sortByOrder(n.children));
  };
  sortByOrder(roots);

  return roots;
}

/**
 * Flatten atom tree to array
 * @param {Array} tree - Tree structure with children
 * @param {string|null} parentLocalId - Parent ID for current level
 * @param {Array} result - Accumulator for flattened nodes
 * @returns {Array} Flattened array without children field
 */
export function flattenAtomTree(tree, parentLocalId = null, result = []) {
  for (const node of tree) {
    const { children, ...nodeWithoutChildren } = node;

    const flatNode = {
      ...nodeWithoutChildren,
      // ?? not || — preserves explicit parent_id: null on root nodes
      parent_id: nodeWithoutChildren.parent_id ?? parentLocalId,
    };
    delete flatNode.children;

    result.push(flatNode);

    if (children && children.length > 0) {
      flattenAtomTree(children, node.local_id, result);
    }
  }
  return result;
}

/**
 * Detect circular references using three-color DFS
 * @param {Array} atoms - Array of atoms with local_id and parent_id
 * @returns {Object} { hasCycle: boolean, path: Array }
 */
export function detectCircularReference(atoms) {
  if (!atoms || atoms.length === 0) {
    return { hasCycle: false, path: [] };
  }

  const graph = new Map();
  const color = new Map();
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  // Build graph
  for (const atom of atoms) {
    graph.set(atom.local_id, atom.parent_id);
    color.set(atom.local_id, WHITE);
  }

  function dfs(localId, currentPath) {
    color.set(localId, GRAY);
    currentPath.push(localId);

    const pid = graph.get(localId);

    if (pid && color.has(pid)) {
      if (color.get(pid) === GRAY) {
        // Found cycle
        const cycleStart = currentPath.indexOf(pid);
        return [...currentPath.slice(cycleStart), pid];
      }
      if (color.get(pid) === WHITE) {
        const result = dfs(pid, currentPath);
        if (result) return result;
      }
    }

    color.set(localId, BLACK);
    currentPath.pop();
    return null;
  }

  for (const localId of graph.keys()) {
    if (color.get(localId) === WHITE) {
      const cycle = dfs(localId, []);
      if (cycle) {
        return { hasCycle: true, path: cycle };
      }
    }
  }

  return { hasCycle: false, path: [] };
}

// Base-62 characters for fractional indexing
const _BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generate fractional index between prev and next
 * Uses base-62 encoding for compact representation
 * @param {string|null} prevIndex - Previous index
 * @param {string|null} nextIndex - Next index
 * @returns {string} New fractional index
 */
export function generateFractionalIndex(prevIndex = null, nextIndex = null) {
  if (!prevIndex && !nextIndex) return 'a0';
  if (!prevIndex) return decrementIndex(nextIndex);
  if (!nextIndex) return incrementIndex(prevIndex);
  return midIndex(prevIndex, nextIndex);
}

/**
 * Increment index by appending '0'
 * @param {string} index - Current index
 * @returns {string} Incremented index
 */
function incrementIndex(index) {
  return index + '0';
}

/**
 * Decrement index by finding midpoint between start and index
 * @param {string} index - Current index
 * @returns {string} Decremented index
 */
function decrementIndex(index) {
  const firstChar = index.charCodeAt(0);
  const mid = Math.floor(firstChar / 2);

  if (mid < 32 || mid === 127) {
    return 'a0';
  }

  return String.fromCharCode(mid) + '0';
}

/**
 * Calculate midpoint between two indices
 * @param {string} a - Lower bound
 * @param {string} b - Upper bound
 * @returns {string} Midpoint index
 */
function midIndex(a, b) {
  // Compare strings lexicographically
  const minLength = Math.min(a.length, b.length);

  for (let i = 0; i < minLength; i++) {
    const aCode = a.charCodeAt(i);
    const bCode = b.charCodeAt(i);

    if (aCode !== bCode) {
      const mid = Math.floor((aCode + bCode) / 2);
      // Ensure mid is strictly between aCode and bCode
      if (mid === aCode) {
        // Need to extend
        return a + 'V';
      }
      return a.substring(0, i) + String.fromCharCode(mid);
    }
  }

  // If all characters are equal up to minLength, extend with midpoint
  if (a.length < b.length) {
    const bNext = b.charCodeAt(a.length);
    const mid = Math.floor((97 + bNext) / 2);
    if (mid <= 97) {
      return a + 'V';
    }
    return a + String.fromCharCode(mid);
  }

  // Equal strings - extend with 'V' (middle of base62)
  return a + 'V';
}

/**
 * Extract wiki links from content
 * @param {string} content - Content to parse
 * @returns {Array} Array of {target, label, isEmbed}
 */
export function extractWikiLinks(content) {
  const regex = /!?\[\[(.+?)(?:\/(.+?))?(?:\|(.+?))?\]\]/g;
  const links = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const isEmbed = match[0].startsWith('!');
    const entityId = match[2] ? match[1] : null;
    const target = match[2] || match[1];
    const label = match[3] || target;

    links.push({
      target,
      entity_id: entityId,
      label,
      isEmbed,
    });
  }
  return links;
}

/**
 * Detect dangling references in atoms
 * @param {Array} atoms - Atom array (flat or tree)
 * @param {Array} allAtoms - All atoms in entity (for reference checking)
 * @returns {Array} Array of dangling references {source, target, type}
 */
export function detectDanglingReferences(atoms, allAtoms) {
  const dangling = [];
  const crossEntityLinks = [];
  let totalChecked = 0;

  // Build set of valid atom IDs
  const validIds = new Set();
  const collectIds = (atomList) => {
    for (const atom of atomList || []) {
      if (atom.local_id) {
        validIds.add(atom.local_id);
      }
      if (atom.children && atom.children.length > 0) {
        collectIds(atom.children);
      }
    }
  };
  collectIds(allAtoms);

  // Check each atom for dangling references
  const checkAtom = (atom) => {
    if (!atom) return;
    totalChecked++;

    // Check wiki links in content
    const links = extractWikiLinks(atom.content || '');
    for (const link of links) {
      if (link.entity_id) {
        crossEntityLinks.push({
          source: atom.local_id,
          target: link.target,
          entity_id: link.entity_id,
          label: link.label,
          type: 'wiki-link',
        });
        continue;
      }
      if (!link.entity_id && !validIds.has(link.target)) {
        dangling.push({
          source: atom.local_id,
          target: link.target,
          type: 'wiki-link',
        });
      }
    }

    // Check parent_id reference
    if (atom.parent_id && !validIds.has(atom.parent_id)) {
      dangling.push({
        source: atom.local_id,
        target: atom.parent_id,
        type: 'parent-reference',
      });
    }

    // Check children recursively
    if (atom.children && atom.children.length > 0) {
      for (const child of atom.children) {
        checkAtom(child);
      }
    }
  };

  for (const atom of atoms || []) {
    checkAtom(atom);
  }

  return {
    dangling,
    cross_entity_links: crossEntityLinks,
    total_checked: totalChecked,
  };
}
