/**
 * 归档测试套件
 * 测试 list_daily, init_daily, rebuild_index, index_status 工具
 */

/**
 * 创建归档测试套件
 */
export function createArchivingTestSuite() {
  return {
    name: '归档测试套件',
    testCases: [
      // TC-070: init_daily - 新日期
      {
        name: 'TC-070: init_daily - 新日期',
        category: '每日日志管理',
        execute: async (engine) => {
          const result = await engine.options.tools.init_daily();
          return { result };
        },
      },

      // TC-071: init_daily - 已存在
      {
        name: 'TC-071: init_daily - 已存在',
        category: '每日日志管理',
        execute: async (engine) => {
          // 第一次初始化
          await engine.options.tools.init_daily();
          // 第二次初始化（应该不覆盖）
          const result = await engine.options.tools.init_daily();
          return { result };
        },
      },

      // TC-072: list_daily - 有日志
      {
        name: 'TC-072: list_daily - 有日志',
        category: '每日日志管理',
        execute: async (engine) => {
          // 先写入一些数据
          await engine.options.tools.memory_write({
            content: '测试数据1',
            type: 'daily',
            tags: 'test',
          });
          await engine.options.tools.memory_write({
            content: '测试数据2',
            type: 'daily',
            tags: 'test',
          });

          const result = await engine.options.tools.list_daily();
          return { result, hasLogs: result.length > 0 };
        },
      },

      // TC-073: list_daily - 无日志
      {
        name: 'TC-073: list_daily - 无日志',
        category: '每日日志管理',
        execute: async (engine) => {
          // 查询不存在的日期范围
          const result = await engine.options.tools.list_daily();
          return { result };
        },
      },

      // TC-074: 连续多日创建
      {
        name: 'TC-074: 连续多日创建',
        category: '每日日志管理',
        execute: async (engine) => {
          const results = [];
          for (let i = 0; i < 5; i++) {
            await engine.options.tools.memory_write({
              content: `第${i}天的数据`,
              type: 'daily',
              tags: 'daily-test',
            });
            results.push(i);
          }

          const listResult = await engine.options.tools.list_daily();
          return { count: results.length, listResult };
        },
      },

      // TC-080: index_status - 初始状态
      {
        name: 'TC-080: index_status - 初始状态',
        category: '索引管理',
        execute: async (engine) => {
          const result = await engine.options.tools.index_status();
          return { result };
        },
      },

      // TC-081: rebuild_index - 完整重建
      {
        name: 'TC-081: rebuild_index - 完整重建',
        category: '索引管理',
        execute: async (engine) => {
          // 先写入一些数据
          for (let i = 0; i < 10; i++) {
            await engine.options.tools.memory_write({
              content: `索引测试数据 ${i}`,
              type: 'long-term',
              tags: 'index-test',
            });
          }

          const result = await engine.options.tools.rebuild_index();
          return { result };
        },
      },

      // TC-082: rebuild_index - 增量重建
      {
        name: 'TC-082: rebuild_index - 增量重建',
        category: '索引管理',
        execute: async (engine) => {
          // 先写入一些数据
          await engine.options.tools.memory_write({
            content: '增量重建测试',
            type: 'long-term',
            tags: 'index-test',
          });

          // 增量重建
          const result = await engine.options.tools.rebuild_index();
          return { result };
        },
      },

      // TC-083: 重建后搜索
      {
        name: 'TC-083: 重建后搜索',
        category: '索引管理',
        execute: async (engine) => {
          // 写入数据
          await engine.options.tools.memory_write({
            content: '重建后搜索测试',
            type: 'long-term',
            tags: 'search-test',
          });

          // 重建索引
          await engine.options.tools.rebuild_index();

          // 搜索
          const result = await engine.options.tools.memory_search({
            query: '重建',
            scope: 'all',
          });
          return { result, found: result.length > 0 };
        },
      },

      // TC-084: 大量数据后重建
      {
        name: 'TC-084: 大量数据后重建',
        category: '索引管理',
        execute: async (engine) => {
          // 写入大量数据
          for (let i = 0; i < 500; i++) {
            await engine.options.tools.memory_write({
              content: `大量数据测试 ${i}`,
              type: 'long-term',
              tags: 'massive-data',
            });
          }

          const startTime = Date.now();
          const result = await engine.options.tools.rebuild_index();
          const duration = Date.now() - startTime;

          return { result, duration, target: '< 5s', passed: duration < 5000 };
        },
      },
    ],
  };
}

export default { createArchivingTestSuite };
