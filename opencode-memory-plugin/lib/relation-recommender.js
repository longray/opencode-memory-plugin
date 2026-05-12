/**
 * 基于本地link-map的关系推荐引擎
 *
 * 使用本地数据和向量搜索发现语义相似的实体，自动推荐关系
 * 提升知识图谱网络密度
 */

import { getWrapperClient } from './wrapper-client.js';
import { getConfig, getLinkMap } from './storage.js';
import { logInfo, logWarn } from './logger.js';
import { PendingReviewQueue } from './pending-review-queue.js';
import {
  RECOMMENDATION_AUTO_CREATE_THRESHOLD,
  RECOMMENDATION_REVIEW_THRESHOLD,
  RECOMMENDATION_AUTO_CREATE_ENABLED,
} from './constants.js';

/**
 * 从link-map获取所有实体
 */
function getLocalEntities() {
  try {
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    return entries.filter(e => e.id && e.abstract);
  } catch (error) {
    logWarn('relation-recommender', `Failed to get local entities: ${error.message}`);
    return [];
  }
}

/**
 * 基于语义相似度推荐关系
 * @param {Object} options
 * @param {number} options.similarityThreshold - 相似度阈值 (0-1)，默认0.7
 * @param {number} options.maxRelationsPerEntity - 每个实体最大关系数，默认3
 * @param {boolean} options.dryRun - 仅预览不创建，默认true
 */
export async function recommendRelationsBySimilarity(options = {}) {
  const { similarityThreshold = 0.7, maxRelationsPerEntity = 3, dryRun = true } = options;

  const client = getWrapperClient(getConfig());
  const recommendations = [];
  let processedCount = 0;
  let createdCount = 0;

  logInfo('relation-recommender', 'Starting semantic similarity-based relation recommendation...');
  logInfo(
    'relation-recommender',
    `Config: threshold=${similarityThreshold}, maxPerEntity=${maxRelationsPerEntity}, dryRun=${dryRun}`
  );

  try {
    // 获取本地实体
    const entities = getLocalEntities();
    logInfo('relation-recommender', `Found ${entities.length} local entities to process`);

    if (entities.length === 0) {
      return {
        success: true,
        processed: 0,
        recommendations: 0,
        created: 0,
        dryRun,
        details: [],
        message: 'No local entities found',
      };
    }

    // 处理每个实体
    const { maxEntities = 50 } = options;
    for (const entity of entities.slice(0, maxEntities)) {
      // 限制处理数量避免API过载
      if (!entity.id || !entity.abstract) continue;

      try {
        // 使用向量搜索找相似实体
        const searchResult = await client.search({
          query: entity.abstract,
          mode: 'vector',
          limit: maxRelationsPerEntity + 2,
        });

        const results = searchResult.results || searchResult.data || [];

        // 过滤掉自己，并按相似度排序
        const similarEntities = results
          .filter(r => r.id !== entity.id && r.score >= similarityThreshold)
          .slice(0, maxRelationsPerEntity);

        if (similarEntities.length === 0) continue;

        // 获取实体已有关系
        let existingTargets = new Set();
        try {
          const existingRelations = await client.getRelations({ memory_id: entity.id });
          existingTargets = new Set(
            (existingRelations.relations || []).map(r => r.to_id || r.target_id)
          );
        } catch {
          // 忽略关系查询错误
        }

        for (const similar of similarEntities) {
          // 跳过已存在关系的
          if (existingTargets.has(similar.id)) continue;

          const recommendation = {
            from_id: entity.id,
            from_abstract: entity.abstract.substring(0, 50),
            to_id: similar.id,
            to_abstract: similar.abstract?.substring(0, 50) || '',
            similarity: similar.score,
            type: 'related',
            weight: Math.round(similar.score * 100) / 100,
          };

          recommendations.push(recommendation);

          // 实际创建关系
          if (!dryRun) {
            try {
              await client.createRelation({
                from_id: entity.id,
                to_id: similar.id,
                type: 'related',
                weight: recommendation.weight,
                description: `Auto-generated based on semantic similarity (${Math.round(similar.score * 100)}%)`,
              });
              createdCount++;
              logInfo(
                'relation-recommender',
                `Created relation: ${entity.id} -> ${similar.id} (score: ${similar.score.toFixed(2)})`
              );
            } catch (error) {
              logWarn('relation-recommender', `Failed to create relation: ${error.message}`);
            }
          }
        }

        processedCount++;

        // 每10个实体报告进度
        if (processedCount % 10 === 0) {
          logInfo(
            'relation-recommender',
            `Progress: ${processedCount}/${Math.min(entities.length, maxEntities)} entities processed, ${recommendations.length} recommendations found`
          );
        }
      } catch (error) {
        logWarn('relation-recommender', `Error processing entity ${entity.id}: ${error.message}`);
      }
    }

    logInfo(
      'relation-recommender',
      `Completed: ${processedCount} entities processed, ${recommendations.length} recommendations, ${createdCount} relations created`
    );

    return {
      success: true,
      processed: processedCount,
      recommendations: recommendations.length,
      created: createdCount,
      dryRun,
      details: recommendations.slice(0, 20), // 只返回前20个详情
    };
  } catch (error) {
    logWarn('relation-recommender', `Error in recommendRelationsBySimilarity: ${error.message}`);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      recommendations: recommendations.length,
    };
  }
}

/**
 * 基于类型和标签推荐关系
 * 相同类型的实体更可能有关系
 * @param {Object} options
 * @param {boolean} options.dryRun - 仅预览不创建，默认true
 * @param {number} options.maxRelationsPerEntity - 每个实体最大关系数，默认2
 */
export async function recommendRelationsByType(options = {}) {
  const { dryRun = true, maxRelationsPerEntity = 2 } = options;

  const client = getWrapperClient(getConfig());
  const recommendations = [];
  let createdCount = 0;

  try {
    const entities = getLocalEntities();
    logInfo(
      'relation-recommender',
      `Found ${entities.length} entities for type-based recommendation`
    );

    // 按类型分组
    const byType = {};
    for (const entity of entities) {
      const type = entity.type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(entity);
    }

    // 为每个实体推荐同类型的其他实体
    for (const [type, typeEntities] of Object.entries(byType)) {
      if (typeEntities.length < 2) continue;

      logInfo(
        'relation-recommender',
        `Processing type '${type}' with ${typeEntities.length} entities`
      );

      const batchRefs = [];

      for (let i = 0; i < typeEntities.length; i++) {
        const entity = typeEntities[i];
        if (!entity.id) continue;

        // 获取已有关系
        let existingTargets = new Set();
        try {
          const existingRelations = await client.getRelations({ memory_id: entity.id });
          existingTargets = new Set(
            (existingRelations.relations || []).map(r => r.to_id || r.target_id)
          );
        } catch {
          // 忽略错误
        }

        // 推荐同类型的其他实体
        let count = 0;
        for (let j = 0; j < typeEntities.length && count < maxRelationsPerEntity; j++) {
          if (i === j) continue;
          const other = typeEntities[j];
          if (!other.id) continue;

          if (existingTargets.has(other.id)) continue;

          recommendations.push({
            from_id: entity.id,
            to_id: other.id,
            type: 'same_type',
            weight: 0.76,
            reason: `Same type: ${type}`,
          });

          if (!dryRun) {
            batchRefs.push({
              from_id: entity.id,
              to_id: other.id,
              type: 'related',
              weight: 0.76,
              description: `Auto-generated: same type (${type})`,
            });
          }

          count++;
        }
      }

      if (!dryRun && batchRefs.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < batchRefs.length; i += BATCH_SIZE) {
          const batch = batchRefs.slice(i, i + BATCH_SIZE);
          try {
            const result = await client.createReferences(batch);
            createdCount += result.created || 0;
          } catch (error) {
            logWarn(
              'relation-recommender',
              `Failed to batch create type relations: ${error.message}`
            );
          }
        }
      }
    }

    logInfo(
      'relation-recommender',
      `Type-based recommendation complete: ${recommendations.length} recommendations, ${createdCount} created`
    );

    return {
      success: true,
      recommendations: recommendations.length,
      created: createdCount,
      dryRun,
      details: recommendations.slice(0, 20),
    };
  } catch (error) {
    logWarn('relation-recommender', `Error in recommendRelationsByType: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 综合关系推荐（语义 + 类型）
 * @param {Object} options
 * @param {boolean} options.dryRun - 仅预览不创建，默认true
 */
export async function enhanceKnowledgeGraph(options = {}) {
  const results = {
    semantic: null,
    typeBased: null,
  };

  logInfo('relation-recommender', '=== Starting Knowledge Graph Enhancement ===');

  // 1. 基于语义相似度
  logInfo('relation-recommender', 'Step 1: Semantic similarity-based recommendations...');
  results.semantic = await recommendRelationsBySimilarity({
    ...options,
    similarityThreshold: 0.75,
  });

  // 2. 基于类型
  logInfo('relation-recommender', 'Step 2: Type-based recommendations...');
  results.typeBased = await recommendRelationsByType(options);

  logInfo('relation-recommender', '=== Knowledge Graph Enhancement Complete ===');

  const totalRecommendations =
    (results.semantic?.recommendations || 0) + (results.typeBased?.recommendations || 0);
  const totalCreated = (results.semantic?.created || 0) + (results.typeBased?.created || 0);

  return {
    success: true,
    totalRecommendations,
    totalCreated,
    dryRun: options.dryRun ?? true,
    semantic: results.semantic,
    typeBased: results.typeBased,
  };
}

/**
 * Classifies a recommendation based on similarity and thresholds
 * @param {number} similarity - Similarity score (0-1)
 * @param {Object} thresholds - Custom thresholds (optional)
 * @returns {'auto_create'|'pending_review'|'ignored'}
 */
export function classifyRecommendation(similarity, thresholds = {}) {
  const autoCreate = thresholds.autoCreate ?? RECOMMENDATION_AUTO_CREATE_THRESHOLD;
  const reviewThreshold = thresholds.reviewThreshold ?? RECOMMENDATION_REVIEW_THRESHOLD;

  if (similarity >= autoCreate) return 'auto_create';
  if (similarity >= reviewThreshold) return 'pending_review';
  return 'ignored';
}

/**
 * Dual threshold recommendation: auto-create high confidence, queue medium confidence
 * @param {Object} options
 * @param {Array} options.recommendations - Array of {from_id, to_id, similarity, type, weight}
 * @param {boolean} options.dryRun - Preview only (default: true)
 * @param {Object} options.thresholds - Custom thresholds
 * @param {boolean} options.autoCreateEnabled - Enable auto-creation (default: from config)
 * @returns {Promise<Object>} Result with counts and details
 */
export async function recommendWithDualThreshold(options = {}) {
  const {
    recommendations = [],
    dryRun = true,
    thresholds = {},
    autoCreateEnabled = RECOMMENDATION_AUTO_CREATE_ENABLED,
  } = options;

  const autoCreateThreshold = thresholds.autoCreate ?? RECOMMENDATION_AUTO_CREATE_THRESHOLD;
  const reviewThreshold = thresholds.reviewThreshold ?? RECOMMENDATION_REVIEW_THRESHOLD;

  let autoCreated = 0;
  let pendingReview = 0;
  let ignored = 0;
  const pendingItems = [];
  const autoCreatedDetails = [];

  const reviewQueue = new PendingReviewQueue();
  const client = !dryRun && autoCreateEnabled ? getWrapperClient(getConfig()) : null;
  const processedPairs = new Set();

  logInfo(
    'relation-recommender',
    `Dual threshold recommendation: autoCreate=${autoCreateThreshold}, review=${reviewThreshold}`
  );

  for (const rec of recommendations) {
    const pairKey = [rec.from_id, rec.to_id].sort().join('|');
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    const classification = classifyRecommendation(rec.similarity, {
      autoCreate: autoCreateThreshold,
      reviewThreshold,
    });

    if (classification === 'auto_create') {
      if (!dryRun && autoCreateEnabled && client) {
        try {
          await client.createRelation({
            from_id: rec.from_id,
            to_id: rec.to_id,
            type: rec.type || 'related',
            weight: rec.weight || rec.similarity,
            description: `Auto-created (similarity: ${Math.round(rec.similarity * 100)}%)`,
          });
          autoCreated++;
          autoCreatedDetails.push(rec);
        } catch (error) {
          logWarn('relation-recommender', `Failed to auto-create relation: ${error.message}`);
        }
      } else {
        autoCreated++;
        autoCreatedDetails.push(rec);
      }
    } else if (classification === 'pending_review') {
      const queueId = reviewQueue.add({
        from_id: rec.from_id,
        to_id: rec.to_id,
        similarity: rec.similarity,
        type: rec.type || 'related',
        weight: rec.weight || rec.similarity,
        description: rec.description || '',
      });
      pendingReview++;
      pendingItems.push({ ...rec, queueId });
    } else {
      ignored++;
    }
  }

  const result = {
    success: true,
    autoCreated,
    pendingReview,
    ignored,
    total: recommendations.length,
    dryRun,
    autoCreatedDetails: autoCreatedDetails.slice(0, 10),
    pendingItems: pendingItems.slice(0, 20),
  };

  logInfo(
    'relation-recommender',
    `Dual threshold complete: ${autoCreated} auto-created, ${pendingReview} pending, ${ignored} ignored`
  );

  return result;
}
