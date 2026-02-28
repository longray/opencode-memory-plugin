  /**
   * 向量搜索
   */
  vectorSearch(query, queryVector) {
    const similarities = this.memoryData.map(record => {
      const recordVector = this.vectorIndex.get(record.id);
      return {
        record,
        similarity: this.cosineSimilarity(queryVector, recordVector),
      };
    });

    return similarities
      .filter(s => s.similarity > 0.1) // 过滤低相似度结果
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(s => s.record);
  }

  /**
   * 混合搜索（70%向量 + 30%BM25）
   */
  hybridSearch(query, queryVector) {
    const bm25Results = this.bm25Search(query);
    const vectorResults = this.vectorSearch(query, queryVector);

    // 为BM25结果评分
    const bm25Scores = new Map();
    bm25Results.forEach((record, index) => {
      bm25Scores.set(record.id, bm25Results.length - index);
    });

    // 为向量结果评分
    const vectorScores = new Map();
    vectorResults.forEach((record, index) => {
      vectorScores.set(record.id, vectorResults.length - index);
    });

    // 合并结果
    const combined = new Map();
    bm25Results.forEach(record => {
      if (!combined.has(record.id)) {
        combined.set(record.id, {
          record,
          bm25Score: bm25Scores.get(record.id) || 0,
          vectorScore: vectorScores.get(record.id) || 0,
        });
      }
    });

    vectorResults.forEach(record => {
      if (combined.has(record.id)) {
        combined.get(record.id).vectorScore = vectorScores.get(record.id);
      } else {
        combined.set(record.id, {
          record,
          bm25Score: bm25Scores.get(record.id) || 0,
          vectorScore: vectorScores.get(record.id),
        });
      }
    });

    // 计算混合分数（70%向量 + 30%BM25）
    const finalResults = Array.from(combined.values())
      .map(item => ({
        record: item.record,
        score: 0.7 * item.vectorScore + 0.3 * item.bm25Score,
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.record);

    return finalResults;
  }
