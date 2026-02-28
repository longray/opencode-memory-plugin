/**
 * 测试数据预处理器 - 批量生成 Embedding 优化
 * 
 * 核心优化：在测试开始前，收集所有需要写入的数据，
 * 一次性批量生成所有 embedding，测试时直接使用缓存
 */

import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';

class TestDataPreprocessor {
  constructor(tools) {
    this.tools = tools;
    this.collectedData = [];
  }

  /**
   * 从测试套件中提取所有需要写入的数据
   */
  extractTestData(testSuites) {
    const testData = [];
    
    for (const suite of testSuites) {
      for (const testCase of suite.testCases) {
        // 分析测试用例，提取写入操作的数据
        const extractedData = this.extractFromTestCase(testCase);
        testData.push(...extractedData);
      }
    }
    
    // 去重
    const uniqueData = [...new Map(testData.map(item => [item.content, item])).values()];
    
    console.log(`📊 数据提取完成:`);
    console.log(`   总测试用例: ${testSuites.reduce((sum, s) => sum + s.testCases.length, 0)}`);
    console.log(`   提取写入操作: ${testData.length}`);
    console.log(`   去重后内容: ${uniqueData.length}`);
    
    return uniqueData;
  }

  /**
   * 从单个测试用例中提取数据
   */
  extractFromTestCase(testCase) {
    const data = [];
    
    // 这里使用简单的启发式规则
    // 实际应该从测试用例的 execute 函数中静态分析
    // 为了简化，我们假设测试用例会写入测试数据
    
    if (testCase.testData) {
      // 如果测试用例有预定义的 testData
      data.push(...testCase.testData.map(d => ({
        content: d.content || d,
        type: d.type || 'test',
        tags: d.tags || ['test'],
      })));
    }
    
    return data;
  }

  /**
   * 批量预生成所有 embedding
   */
  async preGenerateAll(testData) {
    if (!testData || testData.length === 0) {
      console.log('⚠️ 没有需要预生成的数据');
      return;
    }

    console.log(`\n🚀 开始预生成 ${testData.length} 条 embedding...`);
    console.log(`   批量大小: ${this.tools.maxBatchSize}`);
    console.log(`   预计 API 调用: ${Math.ceil(testData.length / this.tools.maxBatchSize)} 次\n`);

    const contents = testData.map(d => d.content);
    
    try {
      // 使用 V5 的批量预生成功能
      await this.tools.preGenerateEmbeddings(contents);
      
      console.log(`\n✅ 预生成完成！`);
      console.log(`   实际 API 调用: ${this.tools.stats.batchApiCalls} 次`);
      console.log(`   缓存大小: ${this.tools.embeddingCache.size} 条`);
      
    } catch (error) {
      console.error('❌ 预生成失败:', error);
      throw error;
    }
  }
}

export default TestDataPreprocessor;
export { TestDataPreprocessor };
