/**
 * 60天模拟测试套件
 * 模拟60天的实际使用场景
 */

/**
 * 创建60天模拟测试套件
 */
export function create60DaySimulationSuite() {
  return {
    name: '60天模拟测试套件',
    testCases: [
      // 阶段1: 初期使用（第1-10天）
      {
        name: '阶段1: 初期使用（Day 1-10）',
        category: '60天模拟',
        execute: async (engine) => {
          const results = [];

          // Day 1-3: 项目初始化
          for (let day = 1; day <= 3; day++) {
            for (let i = 0; i < 33; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 项目初始化: ${i}`,
                type: Math.random() > 0.3 ? 'long-term' : 'daily',
                tags: `day${day},init`,
              });
            }
            results.push({ day, count: 33 });
          }

          // Day 4-7: 开发调试
          for (let day = 4; day <= 7; day++) {
            for (let i = 0; i < 17; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 开发调试: ${i}`,
                type: 'daily',
                tags: `day${day},debug`,
              });
            }
            results.push({ day, count: 17 });
          }

          // Day 8-10: 文档编写
          for (let day = 8; day <= 10; day++) {
            for (let i = 0; i < 15; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 文档编写: ${i}`,
                type: 'daily',
                tags: `day${day},doc`,
              });
            }
            results.push({ day, count: 15 });
          }

          // 验证数据
          const searchResult = await engine.options.tools.memory_search({
            query: '项目初始化',
            scope: 'all',
          });

          return {
            phase: '初期使用',
            days: '1-10',
            totalRecords: results.reduce((sum, r) => sum + r.count, 0),
            found: searchResult.length,
            verified: searchResult.length > 0,
          };
        },
      },

      // 阶段2: 稳定使用（第11-30天）
      {
        name: '阶段2: 稳定使用（Day 11-30）',
        category: '60天模拟',
        execute: async (engine) => {
          const results = [];

          // Day 11-20: 日常开发
          for (let day = 11; day <= 20; day++) {
            for (let i = 0; i < 20; i++) {
              const type = Math.random() > 0.4 ? 'daily' : (Math.random() > 0.5 ? 'long-term' : 'preference');
              await engine.options.tools.memory_write({
                content: `第${day}天 日常开发: ${i}`,
                type,
                tags: `day${day},dev`,
              });
            }
            results.push({ day, count: 20 });
          }

          // Day 21-30: 功能迭代
          for (let day = 21; day <= 30; day++) {
            for (let i = 0; i < 15; i++) {
              const type = Math.random() > 0.5 ? 'daily' : 'long-term';
              await engine.options.tools.memory_write({
                content: `第${day}天 功能迭代: ${i}`,
                type,
                tags: `day${day},feature`,
              });
            }
            results.push({ day, count: 15 });
          }

          // 验证搜索
          const searchResult = await engine.options.tools.memory_search({
            query: '日常开发',
            scope: 'all',
          });

          return {
            phase: '稳定使用',
            days: '11-30',
            totalRecords: results.reduce((sum, r) => sum + r.count, 0),
            found: searchResult.length,
            verified: searchResult.length > 0,
          };
        },
      },

      // 阶段3: 高频使用（第31-45天）
      {
        name: '阶段3: 高频使用（Day 31-45）',
        category: '60天模拟',
        execute: async (engine) => {
          const results = [];

          // Day 31-35: 重构项目
          for (let day = 31; day <= 35; day++) {
            for (let i = 0; i < 60; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 重构项目: ${i}`,
                type: 'daily',
                tags: `day${day},refactor`,
              });
            }
            results.push({ day, count: 60 });
          }

          // Day 36-40: 并发协作
          for (let day = 36; day <= 40; day++) {
            for (let i = 0; i < 50; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 并发协作: ${i}`,
                type: 'daily',
                tags: `day${day},collab`,
              });
            }
            results.push({ day, count: 50 });
          }

          // Day 41-45: 压力测试
          for (let day = 41; day <= 45; day++) {
            for (let i = 0; i < 20; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 压力测试: ${i}`,
                type: 'daily',
                tags: `day${day},stress`,
              });
            }
            results.push({ day, count: 20 });
          }

          // 验证性能
          const startTime = Date.now();
          const searchResult = await engine.options.tools.memory_search({
            query: '重构',
            scope: 'all',
          });
          const duration = Date.now() - startTime;

          return {
            phase: '高频使用',
            days: '31-45',
            totalRecords: results.reduce((sum, r) => sum + r.count, 0),
            searchDuration: duration,
            found: searchResult.length,
            verified: searchResult.length > 0 && duration < 500,
          };
        },
      },

      // 阶段4: 长期使用（第46-60天）
      {
        name: '阶段4: 长期使用（Day 46-60）',
        category: '60天模拟',
        execute: async (engine) => {
          const results = [];

          // Day 46-50: 归档整理
          for (let day = 46; day <= 50; day++) {
            for (let i = 0; i < 20; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 归档整理: ${i}`,
                type: 'daily',
                tags: `day${day},archive`,
              });
            }
            results.push({ day, count: 20 });

            // 定期重建索引
            if (day % 5 === 0) {
              await engine.options.tools.rebuild_index();
            }
          }

          // Day 51-55: 历史查询
          for (let day = 51; day <= 55; day++) {
            for (let i = 0; i < 10; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 历史查询: ${i}`,
                type: 'daily',
                tags: `day${day},history`,
              });

              // 跨期搜索
              await engine.options.tools.memory_search({
                query: `day${day - 20}`,
                scope: 'all',
              });
            }
            results.push({ day, count: 10 });
          }

          // Day 56-60: 长期验证
          for (let day = 56; day <= 60; day++) {
            for (let i = 0; i < 5; i++) {
              await engine.options.tools.memory_write({
                content: `第${day}天 长期验证: ${i}`,
                type: 'long-term',
                tags: `day${day},verify`,
              });

              // 验证早期数据
              await engine.options.tools.memory_search({
                query: '项目初始化',
                scope: 'all',
              });
            }
            results.push({ day, count: 5 });
          }

          // 验证数据持久性
          const earlyData = await engine.options.tools.memory_search({
            query: '项目初始化',
            scope: 'all',
          });

          return {
            phase: '长期使用',
            days: '46-60',
            totalRecords: results.reduce((sum, r) => sum + r.count, 0),
            earlyDataFound: earlyData.length,
            verified: earlyData.length > 0,
          };
        },
      },

      // 跨阶段数据验证
      {
        name: '跨阶段数据验证',
        category: '60天模拟',
        execute: async (engine) => {
          // 验证各个阶段的数据
          const queries = [
            { query: '项目初始化', expectedPhase: '初期使用' },
            { query: '日常开发', expectedPhase: '稳定使用' },
            { query: '重构', expectedPhase: '高频使用' },
            { query: '归档', expectedPhase: '长期使用' },
          ];

          const results = [];
          for (const q of queries) {
            const searchResult = await engine.options.tools.memory_search({
              query: q.query,
              scope: 'all',
            });
            results.push({
              query: q.query,
              expectedPhase: q.expectedPhase,
              found: searchResult.length,
            });
          }

          // 验证所有阶段数据都存在
          const allFound = results.every(r => r.found > 0);

          return {
            results,
            allFound,
            verified: allFound === true,
          };
        },
      },

      // 性能趋势分析
      {
        name: '性能趋势分析',
        category: '60天模拟',
        execute: async (engine) => {
          const performanceData = [];

          // 模拟不同数据量下的性能
          const dataPoints = [100, 500, 1000, 2000, 5000];

          for (const count of dataPoints) {
            // 写入数据
            for (let i = 0; i < count; i++) {
              await engine.options.tools.memory_write({
                content: `性能测试 ${i}`,
                type: 'daily',
                tags: 'perf',
              });
            }

            // 测量搜索性能
            const startTime = Date.now();
            const searchResult = await engine.options.tools.memory_search({
              query: '性能',
              scope: 'all',
            });
            const duration = Date.now() - startTime;

            performanceData.push({
              dataCount: count,
              searchDuration: duration,
              found: searchResult.length,
            });
          }

          // 验证性能在可接受范围内
          const lastDuration = performanceData[performanceData.length - 1].searchDuration;
          const acceptable = lastDuration < 1000; // < 1秒

          return {
            performanceData,
            acceptable,
            verified: acceptable === true,
          };
        },
      },

      // 索引性能测试
      {
        name: '索引性能测试',
        category: '60天模拟',
        execute: async (engine) => {
          const rebuildTimes = [];

          // 在不同数据量下测试索引重建
          const dataPoints = [100, 500, 1000, 2000];

          for (const count of dataPoints) {
            // 写入数据
            for (let i = 0; i < count; i++) {
              await engine.options.tools.memory_write({
                content: `索引测试 ${i}`,
                type: 'long-term',
                tags: 'index-perf',
              });
            }

            // 测量重建时间
            const startTime = Date.now();
            await engine.options.tools.rebuild_index();
            const duration = Date.now() - startTime;

            rebuildTimes.push({
              dataCount: count,
              rebuildDuration: duration,
            });
          }

          // 验证重建时间在可接受范围内
          const lastRebuildTime = rebuildTimes[rebuildTimes.length - 1].rebuildDuration;
          const acceptable = lastRebuildTime < 10000; // < 10秒

          return {
            rebuildTimes,
            acceptable,
            verified: acceptable === true,
          };
        },
      },

      // 最终数据统计
      {
        name: '最终数据统计',
        category: '60天模拟',
        execute: async (engine) => {
          // 获取索引状态
          const indexStatus = await engine.options.tools.index_status();

          // 获取日志列表
          const dailyLogs = await engine.options.tools.list_daily();

          // 统计各类型数据
          const searchResults = {
            'long-term': await engine.options.tools.memory_search({ query: '', scope: 'long-term' }),
            'daily': await engine.options.tools.memory_search({ query: '', scope: 'daily' }),
            'preference': await engine.options.tools.memory_search({ query: '', scope: 'preference' }),
          };

          const statistics = {
            indexStatus,
            dailyLogCount: dailyLogs.length,
            typeDistribution: {
              'long-term': searchResults['long-term'].length,
              'daily': searchResults['daily'].length,
              'preference': searchResults['preference'].length,
            },
            totalRecords: Object.values(searchResults).reduce((sum, r) => sum + r.length, 0),
          };

          return {
            statistics,
            verified: statistics.totalRecords > 0,
          };
        },
      },
    ],
  };
}

export default { create60DaySimulationSuite };
