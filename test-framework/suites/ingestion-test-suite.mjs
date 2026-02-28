/**
 * 入库测试套件
 * 测试 memory_write 工具的各种场景
 */

/**
 * 测试基础入库功能
 */
export function createIngestionTestSuite() {
  return {
    name: '入库测试套件',
    testCases: [
      // TC-001: 短内容long-term入库
      {
        name: 'TC-001: 短内容long-term入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '用户偏好使用TypeScript进行类型检查',
            type: 'long-term',
            tags: 'coding,preference',
          });
          return { result };
        },
      },

      // TC-002: 中等长度long-term入库
      {
        name: 'TC-002: 中等长度long-term入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '代码风格偏好使用2空格缩进，使用Prettier进行自动格式化，在Git提交前自动检查代码格式',
            type: 'long-term',
            tags: 'preference,coding-style',
          });
          return { result };
        },
      },

      // TC-003: 长内容long-term入库
      {
        name: 'TC-003: 长内容long-term入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '决定使用PostgreSQL作为主数据库，因为它支持复杂的查询、事务、外键约束、视图、存储过程等高级特性。同时支持JSON数据类型，适合半结构化数据存储。社区活跃，文档完善，性能优秀。',
            type: 'long-term',
            tags: 'decision,database,architecture',
          });
          return { result };
        },
      },

      // TC-004: 超长内容long-term入库
      {
        name: 'TC-004: 超长内容long-term入库',
        category: '基础入库',
        execute: async (engine) => {
          const longContent = '这是一个非常长的内容，用于测试系统处理长文本的能力。'.repeat(100);
          const result = await engine.options.tools.memory_write({
            content: longContent,
            type: 'long-term',
            tags: 'stress-test,long-content',
          });
          return { result };
        },
      },

      // TC-005: 短内容daily入库
      {
        name: 'TC-005: 短内容daily入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '今天正在实现用户认证功能',
            type: 'daily',
            tags: 'context,today',
          });
          return { result };
        },
      },

      // TC-006: 中等长度daily入库
      {
        name: 'TC-006: 中等长度daily入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '正在调试登录流程中的会话管理问题，发现token过期时间设置不合理，需要调整',
            type: 'daily',
            tags: 'debugging,auth',
          });
          return { result };
        },
      },

      // TC-007: 长内容daily入库
      {
        name: 'TC-007: 长内容daily入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '正在优化数据库查询性能，添加了多个索引，使用了查询计划分析，优化了N+1查询问题，使用了缓存层，显著提高了响应速度',
            type: 'daily',
            tags: 'optimization,performance',
          });
          return { result };
        },
      },

      // TC-008: 短内容preference入库
      {
        name: 'TC-008: 短内容preference入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '编辑器偏好使用VS Code',
            type: 'preference',
            tags: 'user-setting,editor',
          });
          return { result };
        },
      },

      // TC-009: 中等长度preference入库
      {
        name: 'TC-009: 中等长度preference入库',
        category: '基础入库',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '代码格式化工具偏好使用Prettier，配置文件使用.prettierrc，启用自动格式化保存',
            type: 'preference',
            tags: 'user-setting,formatting',
          });
          return { result };
        },
      },

      // TC-010: 中日韩字符入库
      {
        name: 'TC-010: 中日韩字符入库',
        category: '特殊内容',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '中文、日本語、한글混合内容测试',
            type: 'long-term',
            tags: 'i18n,multilingual',
          });
          return { result };
        },
      },

      // TC-011: Emoji表情入库
      {
        name: 'TC-011: Emoji表情入库',
        category: '特殊内容',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '项目状态: 🚀 正在开发中 🎉 完成了核心功能 ⚠️ 需要修复bug',
            type: 'daily',
            tags: 'status,emoji',
          });
          return { result };
        },
      },

      // TC-012: 特殊符号入库
      {
        name: 'TC-012: 特殊符号入库',
        category: '特殊内容',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: '特殊字符测试: @#$%^&*()_+-=[]{}|;:,.<>?',
            type: 'long-term',
            tags: 'special-chars',
          });
          return { result };
        },
      },

      // TC-013: HTML/XML实体入库
      {
        name: 'TC-013: HTML/XML实体入库',
        category: '特殊内容',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: 'HTML实体: &lt;div&gt;&amp;&copy;</div>',
            type: 'long-term',
            tags: 'html,entities',
          });
          return { result };
        },
      },

      // TC-014: 代码片段入库
      {
        name: 'TC-014: 代码片段入库',
        category: '特殊内容',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: 'async function fetchData(url) { const response = await fetch(url); return response.json(); }',
            type: 'long-term',
            tags: 'code,javascript',
          });
          return { result };
        },
      },

      // TC-015: URL链接入库
      {
        name: 'TC-015: URL链接入库',
        category: '特殊内容',
        execute: async (engine) => {
          const result = await engine.options.tools.memory_write({
            content: 'API文档地址: https://api.example.com/v1/docs',
            type: 'long-term',
            tags: 'documentation,api',
          });
          return { result };
        },
      },

      // TC-016: 空内容入库（应该拒绝）
      {
        name: 'TC-016: 空内容入库（应该拒绝）',
        category: '边界条件',
        execute: async (engine) => {
          try {
            await engine.options.tools.memory_write({
              content: '',
              type: 'long-term',
              tags: 'test',
            });
            return { success: false, reason: '空内容应该被拒绝' };
          } catch (error) {
            return { success: true, reason: '正确拒绝空内容' };
          }
        },
      },

      // TC-017: 超长内容入库（>100KB）
      {
        name: 'TC-017: 超长内容入库（>100KB）',
        category: '边界条件',
        execute: async (engine) => {
          const hugeContent = 'A'.repeat(100000);
          const result = await engine.options.tools.memory_write({
            content: hugeContent,
            type: 'long-term',
            tags: 'stress-test,huge-content',
          });
          return { result };
        },
      },

      // TC-018: 标签数量上限
      {
        name: 'TC-018: 标签数量上限',
        category: '边界条件',
        execute: async (engine) => {
          const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(',');
          const result = await engine.options.tools.memory_write({
            content: '测试大量标签',
            type: 'long-term',
            tags: manyTags,
          });
          return { result };
        },
      },

      // TC-019: 标签长度上限
      {
        name: 'TC-019: 标签长度上限',
        category: '边界条件',
        execute: async (engine) => {
          const longTag = 'very-long-tag-name-' + 'x'.repeat(100);
          const result = await engine.options.tools.memory_write({
            content: '测试长标签',
            type: 'long-term',
            tags: longTag,
          });
          return { result };
        },
      },

      // TC-020: 同一内容重复入库
      {
        name: 'TC-020: 同一内容重复入库',
        category: '边界条件',
        execute: async (engine) => {
          const content = '重复内容测试';
          await engine.options.tools.memory_write({
            content,
            type: 'long-term',
            tags: 'duplicate',
          });
          const result = await engine.options.tools.memory_write({
            content,
            type: 'long-term',
            tags: 'duplicate',
          });
          return { result };
        },
      },

      // TC-021: 连续快速入库
      {
        name: 'TC-021: 连续快速入库',
        category: '边界条件',
        execute: async (engine) => {
          const promises = [];
          for (let i = 0; i < 10; i++) {
            promises.push(
              engine.options.tools.memory_write({
                content: `快速入库测试 ${i}`,
                type: 'daily',
                tags: 'rapid,concurrent',
              })
            );
          }
          const results = await Promise.all(promises);
          return { count: results.length };
        },
      },
    ],
  };
}

export default { createIngestionTestSuite };
