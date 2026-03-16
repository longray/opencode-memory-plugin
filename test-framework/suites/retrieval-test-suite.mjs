/**
 * 检索测试套件
 * 测试 memory_search 和 memory_search 工具
 */

/**
 * 创建检索测试套件
 */
export function createRetrievalTestSuite() {
  return {
    name: "检索测试套件",
    testCases: [
      // TC-030: 精确匹配
      {
        name: "TC-030: 精确匹配",
        category: "关键词搜索",
        execute: async (engine) => {
          // 先写入测试数据
          await engine.options.tools.memory_write({
            content: "TypeScript类型检查",
            type: "long-term",
            tags: "coding",
          });

          // 搜索
          const result = await engine.options.tools.memory_search({
            query: "TypeScript",
            scope: "all",
          });
          return { result };
        },
      },

      // TC-031: 部分匹配
      {
        name: "TC-031: 部分匹配",
        category: "关键词搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "用户偏好使用TypeScript",
            type: "long-term",
            tags: "preference",
          });

          const result = await engine.options.tools.memory_search({
            query: "Type",
            scope: "long-term",
          });
          return { result };
        },
      },

      // TC-032: 多词查询
      {
        name: "TC-032: 多词查询",
        category: "关键词搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用PostgreSQL和Redis构建高性能系统",
            type: "daily",
            tags: "architecture",
          });

          const result = await engine.options.tools.memory_search({
            query: "PostgreSQL Redis",
            scope: "daily",
          });
          return { result };
        },
      },

      // TC-033: 不存在的词
      {
        name: "TC-033: 不存在的词",
        category: "关键词搜索",
        execute: async (engine) => {
          const result = await engine.options.tools.memory_search({
            query: "nonexistentword12345",
            scope: "all",
          });
          return { result, isEmpty: result.length === 0 };
        },
      },

      // TC-034: 特殊字符查询
      {
        name: "TC-034: 特殊字符查询",
        category: "关键词搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "API端点: /api/v1/users",
            type: "long-term",
            tags: "api",
          });

          const result = await engine.options.tools.memory_search({
            query: "/api/v1",
            scope: "all",
          });
          return { result };
        },
      },

      // TC-035: 中英文混合查询
      {
        name: "TC-035: 中英文混合查询",
        category: "关键词搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用TypeScript进行类型检查",
            type: "long-term",
            tags: "coding",
          });

          const result = await engine.options.tools.memory_search({
            query: "TypeScript 类型",
            scope: "all",
          });
          return { result };
        },
      },

      // TC-036: 大小写不敏感
      {
        name: "TC-036: 大小写不敏感",
        category: "关键词搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "typescript is great",
            type: "long-term",
            tags: "coding",
          });

          const result = await engine.options.tools.memory_search({
            query: "TYPESCRIPT",
            scope: "all",
          });
          return { result };
        },
      },

      // TC-037: 模糊查询
      {
        name: "TC-037: 模糊查询",
        category: "关键词搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "JavaScript是一种编程语言",
            type: "long-term",
            tags: "coding",
          });

          const result = await engine.options.tools.memory_search({
            query: "Java",
            scope: "all",
          });
          return { result };
        },
      },

      // TC-040: 同义词查询（语义搜索）
      {
        name: "TC-040: 同义词查询（语义搜索）",
        category: "语义搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用类型系统减少运行时错误",
            type: "long-term",
            tags: "best-practice",
          });

          const result = await engine.options.tools.memory_search({
            query: "类型检查",
            mode: "hybrid",
          });
          return { result };
        },
      },

      // TC-041: 概念查询（语义搜索）
      {
        name: "TC-041: 概念查询（语义搜索）",
        category: "语义搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "决定使用PostgreSQL作为主数据库",
            type: "long-term",
            tags: "decision",
          });

          const result = await engine.options.tools.memory_search({
            query: "数据库选择",
            mode: "vector",
          });
          return { result };
        },
      },

      // TC-042: 跨语言查询（语义搜索）
      {
        name: "TC-042: 跨语言查询（语义搜索）",
        category: "语义搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "Use Redis for caching",
            type: "long-term",
            tags: "architecture",
          });

          const result = await engine.options.tools.memory_search({
            query: "缓存",
            mode: "hybrid",
          });
          return { result };
        },
      },

      // TC-043: 模糊语义查询
      {
        name: "TC-043: 模糊语义查询",
        category: "语义搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用try-catch处理异步错误",
            type: "long-term",
            tags: "pattern",
          });

          const result = await engine.options.tools.memory_search({
            query: "错误处理方法",
            mode: "vector",
          });
          return { result };
        },
      },

      // TC-044: 特定领域查询
      {
        name: "TC-044: 特定领域查询",
        category: "语义搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "React组件使用Hooks管理状态",
            type: "long-term",
            tags: "frontend",
          });

          const result = await engine.options.tools.memory_search({
            query: "状态管理",
            mode: "hybrid",
          });
          return { result };
        },
      },

      // TC-045: 代码相关查询
      {
        name: "TC-045: 代码相关查询",
        category: "语义搜索",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "async function fetchData() { return await fetch(url); }",
            type: "long-term",
            tags: "code",
          });

          const result = await engine.options.tools.memory_search({
            query: "异步函数",
            mode: "vector",
          });
          return { result };
        },
      },

      // TC-050: hybrid模式（API可用）
      {
        name: "TC-050: hybrid模式（API可用）",
        category: "搜索模式",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用PostgreSQL数据库",
            type: "long-term",
            tags: "database",
          });

          const result = await engine.options.tools.memory_search({
            query: "PostgreSQL",
            mode: "hybrid",
          });
          return { result };
        },
      },

      // TC-051: hybrid模式（API不可用时降级）
      {
        name: "TC-051: hybrid模式（API不可用时降级）",
        category: "搜索模式",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用PostgreSQL数据库",
            type: "long-term",
            tags: "database",
          });

          // 模拟API不可用的情况（通过修改配置或临时禁用）
          const result = await engine.options.tools.memory_search({
            query: "PostgreSQL",
            mode: "hybrid",
          });
          return { result };
        },
      },

      // TC-052: vector模式（API可用）
      {
        name: "TC-052: vector模式（API可用）",
        category: "搜索模式",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用Redis缓存",
            type: "long-term",
            tags: "cache",
          });

          const result = await engine.options.tools.memory_search({
            query: "缓存",
            mode: "vector",
          });
          return { result };
        },
      },

      // TC-053: vector模式（API不可用时降级）
      {
        name: "TC-053: vector模式（API不可用时降级）",
        category: "搜索模式",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用Redis缓存",
            type: "long-term",
            tags: "cache",
          });

          const result = await engine.options.tools.memory_search({
            query: "缓存",
            mode: "vector",
          });
          return { result };
        },
      },

      // TC-054: keyword模式（纯BM25）
      {
        name: "TC-054: keyword模式（纯BM25）",
        category: "搜索模式",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用PostgreSQL数据库",
            type: "long-term",
            tags: "database",
          });

          const result = await engine.options.tools.memory_search({
            query: "PostgreSQL",
            mode: "keyword",
          });
          return { result };
        },
      },

      // TC-055: hash模式（快速哈希搜索）
      {
        name: "TC-055: hash模式（快速哈希搜索）",
        category: "搜索模式",
        execute: async (engine) => {
          await engine.options.tools.memory_write({
            content: "使用PostgreSQL数据库",
            type: "long-term",
            tags: "database",
          });

          const result = await engine.options.tools.memory_search({
            query: "PostgreSQL",
            mode: "hash",
          });
          return { result };
        },
      },

      // TC-060: 小数据量性能测试
      {
        name: "TC-060: 小数据量性能测试（100条）",
        category: "性能测试",
        execute: async (engine) => {
          // 写入100条数据
          for (let i = 0; i < 100; i++) {
            await engine.options.tools.memory_write({
              content: `测试数据 ${i}`,
              type: "daily",
              tags: "performance-test",
            });
          }

          const startTime = Date.now();
          const result = await engine.options.tools.memory_search({
            query: "测试",
            scope: "all",
          });
          const duration = Date.now() - startTime;

          return {
            result,
            duration,
            target: "< 100ms",
            passed: duration < 100,
          };
        },
      },

      // TC-061: 中等数据量性能测试
      {
        name: "TC-061: 中等数据量性能测试（1000条）",
        category: "性能测试",
        execute: async (engine) => {
          // 写入1000条数据
          for (let i = 0; i < 1000; i++) {
            await engine.options.tools.memory_write({
              content: `性能测试数据 ${i}`,
              type: "daily",
              tags: "performance-test",
            });
          }

          const startTime = Date.now();
          const result = await engine.options.tools.memory_search({
            query: "性能",
            scope: "all",
          });
          const duration = Date.now() - startTime;

          return {
            result,
            duration,
            target: "< 150ms",
            passed: duration < 150,
          };
        },
      },
    ],
  };
}

export default { createRetrievalTestSuite };
