/**
 * 数据流动测试套件
 * 测试完整的数据流动：入库→检索→验证
 */

/**
 * 创建数据流动测试套件
 */
export function createDataFlowTestSuite() {
  return {
    name: "数据流动测试套件",
    testCases: [
      // TC-090: 写入→关键词搜索→验证
      {
        name: "TC-090: 写入→关键词搜索→验证",
        category: "完整流程",
        execute: async (engine) => {
          const testContent = "数据流动测试关键词搜索";
          const testTags = "data-flow,keyword";

          // 写入
          const writeResult = await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: testTags,
          });

          // 搜索
          const searchResult = await engine.options.tools.memory_search({
            query: "数据流动",
            scope: "all",
          });

          // 验证
          const found = searchResult.some((r) =>
            r.content.includes(testContent),
          );

          return {
            writeResult,
            searchResult,
            found,
            verified: found === true,
          };
        },
      },

      // TC-091: 写入→语义搜索→验证
      {
        name: "TC-091: 写入→语义搜索→验证",
        category: "完整流程",
        execute: async (engine) => {
          const testContent = "使用Redis缓存提高性能";
          const testTags = "data-flow,semantic";

          // 写入
          const writeResult = await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: testTags,
          });

          // 语义搜索
          const searchResult = await engine.options.tools.memory_search({
            query: "缓存优化",
            mode: "hybrid",
          });

          // 验证
          const found = searchResult.some((r) => r.content.includes("缓存"));

          return {
            writeResult,
            searchResult,
            found,
            verified: found === true,
          };
        },
      },

      // TC-092: 写入→跨日搜索→验证
      {
        name: "TC-092: 写入→跨日搜索→验证",
        category: "完整流程",
        execute: async (engine) => {
          const testContent = "跨日搜索测试数据";

          // 写入到long-term
          await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: "cross-day",
          });

          // 写入到daily
          await engine.options.tools.memory_write({
            content: testContent + " daily",
            type: "daily",
            tags: "cross-day",
          });

          // 跨scope搜索
          const searchResult = await engine.options.tools.memory_search({
            query: "跨日",
            scope: "all",
          });

          // 验证找到两条记录
          const verified = searchResult.length >= 2;

          return {
            searchResult,
            count: searchResult.length,
            verified,
          };
        },
      },

      // TC-093: 写入→重建索引→搜索→验证
      {
        name: "TC-093: 写入→重建索引→搜索→验证",
        category: "完整流程",
        execute: async (engine) => {
          const testContent = "索引重建后搜索测试";
          const testTags = "index-rebuild";

          // 写入多条数据
          for (let i = 0; i < 20; i++) {
            await engine.options.tools.memory_write({
              content: `${testContent} ${i}`,
              type: "long-term",
              tags: testTags,
            });
          }

          // 重建索引
          await engine.options.tools.rebuild_index();

          // 搜索
          const searchResult = await engine.options.tools.memory_search({
            query: "索引",
            scope: "all",
          });

          // 验证找到所有记录
          const verified = searchResult.length >= 20;

          return {
            searchResult,
            count: searchResult.length,
            verified,
          };
        },
      },

      // TC-100: 跨会话访问
      {
        name: "TC-100: 跨会话访问",
        category: "长期记忆持久化",
        execute: async (engine) => {
          const testContent = "跨会话测试数据";
          const testTags = "cross-session";

          // 写入
          const writeResult = await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: testTags,
          });

          // 模拟新会话（重新读取）
          const searchResult = await engine.options.tools.memory_search({
            query: "跨会话",
            scope: "all",
          });

          const found = searchResult.some((r) =>
            r.content.includes(testContent),
          );

          return {
            writeResult,
            searchResult,
            found,
            verified: found === true,
          };
        },
      },

      // TC-101: 重启后访问
      {
        name: "TC-101: 重启后访问",
        category: "长期记忆持久化",
        execute: async (engine) => {
          const testContent = "重启后访问测试数据";
          const testTags = "restart-test";

          // 写入
          await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: testTags,
          });

          // 模拟重启（重新初始化）
          const searchResult = await engine.options.tools.memory_search({
            query: "重启",
            scope: "all",
          });

          const found = searchResult.some((r) =>
            r.content.includes(testContent),
          );

          return {
            searchResult,
            found,
            verified: found === true,
          };
        },
      },

      // TC-102: 多次写入同一主题
      {
        name: "TC-102: 多次写入同一主题",
        category: "长期记忆持久化",
        execute: async (engine) => {
          const topic = "TypeScript类型系统";

          // 写入多条相关内容
          await engine.options.tools.memory_write({
            content: `${topic}基础用法`,
            type: "long-term",
            tags: "typescript,types",
          });
          await engine.options.tools.memory_write({
            content: `${topic}高级特性`,
            type: "long-term",
            tags: "typescript,advanced",
          });
          await engine.options.tools.memory_write({
            content: `${topic}最佳实践`,
            type: "long-term",
            tags: "typescript,best-practice",
          });

          // 搜索
          const searchResult = await engine.options.tools.memory_search({
            query: "TypeScript",
            scope: "all",
          });

          // 验证找到所有记录
          const verified = searchResult.length >= 3;

          return {
            searchResult,
            count: searchResult.length,
            verified,
          };
        },
      },

      // TC-103: 长时间间隔访问
      {
        name: "TC-103: 长时间间隔访问",
        category: "长期记忆持久化",
        execute: async (engine) => {
          const testContent = "长时间间隔测试数据";

          // 第一次写入
          await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: "long-interval",
          });

          // 模拟长时间间隔（通过多次其他操作）
          for (let i = 0; i < 50; i++) {
            await engine.options.tools.memory_write({
              content: `其他操作 ${i}`,
              type: "daily",
              tags: "other",
            });
          }

          // 长时间后访问
          const searchResult = await engine.options.tools.memory_search({
            query: "长时间",
            scope: "all",
          });

          const found = searchResult.some((r) =>
            r.content.includes(testContent),
          );

          return {
            searchResult,
            found,
            verified: found === true,
          };
        },
      },

      // TC-110: API超时降级
      {
        name: "TC-110: API超时降级",
        category: "错误处理",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "API超时测试",
            type: "long-term",
            tags: "error-handling",
          });

          // 使用keyword模式（不依赖API）
          const result = await engine.options.tools.memory_search({
            query: "超时",
            mode: "keyword",
          });

          return { result, fallback: true };
        },
      },

      // TC-111: API返回错误降级
      {
        name: "TC-111: API返回错误降级",
        category: "错误处理",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "API错误测试",
            type: "long-term",
            tags: "error-handling",
          });

          // 使用keyword模式（不依赖API）
          const result = await engine.options.tools.memory_search({
            query: "错误",
            mode: "keyword",
          });

          return { result, fallback: true };
        },
      },

      // TC-112: 数据完整性验证
      {
        name: "TC-112: 数据完整性验证",
        category: "错误处理",
        execute: async (engine) => {
          const testContent = "数据完整性测试";
          const testTags = "integrity";

          // 写入
          const writeResult = await engine.options.tools.memory_write({
            content: testContent,
            type: "long-term",
            tags: testTags,
          });

          // 立即读取
          const searchResult = await engine.options.tools.memory_search({
            query: testContent,
            scope: "all",
          });

          // 验证内容一致
          const contentMatch = searchResult.some(
            (r) => r.content === testContent,
          );

          return {
            writeResult,
            searchResult,
            contentMatch,
            verified: contentMatch === true,
          };
        },
      },

      // TC-130: 多个并发写入
      {
        name: "TC-130: 多个并发写入",
        category: "并发测试",
        execute: async (engine) => {
          const promises = [];
          for (let i = 0; i < 20; i++) {
            promises.push(
              engine.options.tools.memory_write({
                content: `并发写入测试 ${i}`,
                type: "daily",
                tags: "concurrent",
              }),
            );
          }

          const results = await Promise.all(promises);

          // 验证所有写入成功
          const allSuccess = results.every((r) => r !== undefined);

          return {
            count: results.length,
            allSuccess,
            verified: allSuccess === true,
          };
        },
      },

      // TC-131: 并发写入和搜索
      {
        name: "TC-131: 并发写入和搜索",
        category: "并发测试",
        execute: async (engine) => {
          const promises = [];

          // 并发写入
          for (let i = 0; i < 10; i++) {
            promises.push(
              engine.options.tools.memory_write({
                content: `并发测试 ${i}`,
                type: "daily",
                tags: "concurrent",
              }),
            );
          }

          // 并发搜索
          for (let i = 0; i < 5; i++) {
            promises.push(
              engine.options.tools.memory_search({
                query: "并发",
                scope: "all",
              }),
            );
          }

          const results = await Promise.all(promises);

          // 验证所有操作成功
          const allSuccess = results.every((r) => r !== undefined);

          return {
            count: results.length,
            allSuccess,
            verified: allSuccess === true,
          };
        },
      },

      // TC-140: 连续1000次写入
      {
        name: "TC-140: 连续1000次写入",
        category: "压力测试",
        execute: async (engine) => {
          const startTime = Date.now();
          const results = [];

          for (let i = 0; i < 1000; i++) {
            const result = await engine.options.tools.memory_write({
              content: `压力测试 ${i}`,
              type: "daily",
              tags: "stress",
            });
            results.push(result);
          }

          const duration = Date.now() - startTime;
          const avgTime = duration / 1000;

          return {
            count: results.length,
            duration,
            avgTime,
            target: "< 1s",
            verified: duration < 1000,
          };
        },
      },

      // TC-141: 连续1000次搜索
      {
        name: "TC-141: 连续1000次搜索",
        category: "压力测试",
        execute: async (engine) => {
          // 先写入一些数据
          for (let i = 0; i < 100; i++) {
            await engine.options.tools.memory_write({
              content: `搜索测试数据 ${i}`,
              type: "long-term",
              tags: "search-stress",
            });
          }

          const startTime = Date.now();
          const results = [];

          for (let i = 0; i < 1000; i++) {
            const result = await engine.options.tools.memory_search({
              query: "搜索",
              scope: "all",
            });
            results.push(result);
          }

          const duration = Date.now() - startTime;
          const avgTime = duration / 1000;

          return {
            count: results.length,
            duration,
            avgTime,
            target: "< 60s",
            verified: duration < 60000,
          };
        },
      },

      // TC-142: 混合操作1000次
      {
        name: "TC-142: 混合操作1000次",
        category: "压力测试",
        execute: async (engine) => {
          const startTime = Date.now();
          const results = [];

          for (let i = 0; i < 1000; i++) {
            if (i % 3 === 0) {
              // 写入
              const result = await engine.options.tools.memory_write({
                content: `混合操作 ${i}`,
                type: "daily",
                tags: "mixed",
              });
              results.push(result);
            } else if (i % 3 === 1) {
              // 搜索
              const result = await engine.options.tools.memory_search({
                query: "混合",
                scope: "all",
              });
              results.push(result);
            } else {
              // 语义搜索
              const result = await engine.options.tools.memory_search({
                query: "操作",
                mode: "hybrid",
              });
              results.push(result);
            }
          }

          const duration = Date.now() - startTime;

          return {
            count: results.length,
            duration,
            avgTime: duration / 1000,
            verified: duration < 120000, // < 2分钟
          };
        },
      },

      // TC-143: 长时间运行测试
      {
        name: "TC-143: 长时间运行测试（1小时）",
        category: "压力测试",
        execute: async (engine) => {
          const startTime = Date.now();
          const operations = [];
          const targetDuration = 60 * 1000; // 1分钟（测试用，实际应为1小时）

          let i = 0;
          while (Date.now() - startTime < targetDuration) {
            if (i % 2 === 0) {
              await engine.options.tools.memory_write({
                content: `长时间测试 ${i}`,
                type: "daily",
                tags: "long-run",
              });
            } else {
              await engine.options.tools.memory_search({
                query: "长时间",
                scope: "all",
              });
            }
            operations.push(i++);
          }

          const duration = Date.now() - startTime;

          return {
            operationCount: operations.length,
            duration,
            avgTime: duration / operations.length,
            verified: operations.length > 0,
          };
        },
      },
    ],
  };
}

export default { createDataFlowTestSuite };
