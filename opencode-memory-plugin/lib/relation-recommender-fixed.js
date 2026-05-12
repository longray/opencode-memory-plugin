/**
 * 基于后端实体的关系推荐引擎（修复版 - v2.0）
 *
 * 使用后端API获取实体（RecordID格式），通过向量搜索发现语义相似的实体，自动创建关系
 * 提升知识图谱网络密度
 *
 * 更新日志:
 * - v2.0: 切换回使用 listEntities API（后端已修复 Pydantic 验证错误）
 */

import { getWrapperClient } from './wrapper-client.js';
import { getConfig } from './storage.js';
import { logInfo, logWarn } from './logger.js';

/**
 * 基于语义相似度推荐并创建关系（使用后端实体）
 * @param {Object} options
 * @param {number} options.similarityThreshold - 相似度阈值 (0-1)，默认0.75
 * @param {number} options.maxRelationsPerEntity - 每个实体最大关系数，默认3
 * @param {number} options.maxEntities - 最大处理实体数，默认50
 * @param {boolean} options.dryRun - 仅预览不创建，默认true
 */
export async function recommendAndCreateRelations(options = {}) {
  const {
    similarityThreshold = 0.75,
    maxRelationsPerEntity = 3,
    maxEntities = 50,
    dryRun = true,
  } = options;

  const client = getWrapperClient(getConfig());
  const recommendations = [];
  let processedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;

  logInfo('relation-recommender', 'Starting relation recommendation and creation...');
  logInfo(
    'relation-recommender',
    `Config: threshold=${similarityThreshold}, maxPerEntity=${maxRelationsPerEntity}, maxEntities=${maxEntities}, dryRun=${dryRun}`
  );

  try {
    // 从后端获取实体（使用 listEntities API - 后端已修复）
    logInfo('relation-recommender', 'Fetching entities from backend via listEntities...');

    const listResult = await client.listEntities({ limit: maxEntities });
    const allEntities = listResult.data || [];

    logInfo(
      'relation-recommender',
      `Found ${allEntities.length} entities from listEntities (total: ${listResult.total})`
    );

    if (allEntities.length === 0) {
      return {
        success: true,
        processed: 0,
        recommendations: 0,
        created: 0,
        skipped: 0,
        dryRun,
        message: 'No entities found in backend',
      };
    }

    // 处理每个实体
    for (let i = 0; i < Math.min(allEntities.length, maxEntities); i++) {
      const entity = allEntities[i];
      if (!entity.id) continue;

      // 使用abstract或overview作为搜索查询
      const queryText = entity.abstract || entity.overview || entity.content || '';
      if (!queryText || queryText.length < 10) {
        skippedCount++;
        continue;
      }

      try {
        // 使用向量搜索找相似实体
        const searchResult = await client.search({
          query: queryText.substring(0, 200),
          mode: 'vector',
          limit: maxRelationsPerEntity + 5,
        });

        const results = searchResult.results || [];

        // 过滤掉自己，并按相似度排序
        const similarEntities = results
          .filter(r => r.id !== entity.id && r.score >= similarityThreshold)
          .slice(0, maxRelationsPerEntity);

        if (similarEntities.length === 0) {
          skippedCount++;
          continue;
        }

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
          if (existingTargets.has(similar.id)) {
            skippedCount++;
            continue;
          }

          const recommendation = {
            from_id: entity.id,
            from_abstract: (entity.abstract || '').substring(0, 50),
            to_id: similar.id,
            to_abstract: (similar.abstract || '').substring(0, 50),
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
                `Created relation: ${entity.id.substring(0, 30)}... -> ${similar.id.substring(0, 30)}... (score: ${similar.score.toFixed(2)})`
              );
            } catch (error) {
              logWarn('relation-recommender', `Failed to create relation: ${error.message}`);
              skippedCount++;
            }
          }
        }

        processedCount++;

        // 每10个实体报告进度
        if (processedCount % 10 === 0) {
          logInfo(
            'relation-recommender',
            `Progress: ${processedCount}/${Math.min(allEntities.length, maxEntities)} entities processed, ${recommendations.length} recommendations, ${createdCount} created`
          );
        }

        // 小延迟避免API过载
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logWarn('relation-recommender', `Error processing entity ${entity.id}: ${error.message}`);
        skippedCount++;
      }
    }

    logInfo(
      'relation-recommender',
      `Completed: ${processedCount} entities processed, ${recommendations.length} recommendations, ${createdCount} relations created, ${skippedCount} skipped`
    );

    return {
      success: true,
      processed: processedCount,
      recommendations: recommendations.length,
      created: createdCount,
      skipped: skippedCount,
      dryRun,
      details: recommendations.slice(0, 20),
    };
  } catch (error) {
    logWarn('relation-recommender', `Error in recommendAndCreateRelations: ${error.message}`);
    return {
      success: false,
      error: error.message,
      processed: processedCount,
      recommendations: recommendations.length,
      created: createdCount,
    };
  }
}

/**
 * 批量创建语义相似度关系
 * @param {Object} options
 * @param {number} options.count - 要创建的关系数量，默认50
 * @param {boolean} options.dryRun - 仅预览不创建，默认false
 */
export async function batchCreateSemanticRelations(options = {}) {
  const { count = 50, dryRun = false } = options;

  logInfo('relation-recommender', `Starting batch creation of ${count} semantic relations...`);

  const result = await recommendAndCreateRelations({
    dryRun,
    similarityThreshold: 0.75,
    maxRelationsPerEntity: 2,
    maxEntities: Math.ceil(count / 2), // 每个实体平均2个关系
  });

  return {
    ...result,
    targetCount: count,
    completionRate: count > 0 ? Math.round((result.created / count) * 100) : 0,
  };
}

/**
 * 综合关系增强（仅语义相似度）
 * @param {Object} options
 * @param {number} options.targetRelations - 目标关系数量，默认50
 * @param {boolean} options.dryRun - 仅预览不创建，默认false
 */
export async function enhanceKnowledgeGraph(options = {}) {
  const { targetRelations = 50, dryRun = false } = options;

  logInfo('relation-recommender', '=== Starting Knowledge Graph Enhancement ===');

  const result = await batchCreateSemanticRelations({
    count: targetRelations,
    dryRun,
  });

  logInfo('relation-recommender', '=== Knowledge Graph Enhancement Complete ===');

  return {
    success: result.success,
    targetRelations,
    created: result.created,
    recommendations: result.recommendations,
    completionRate: result.completionRate,
    dryRun,
    details: result.details,
  };
}
