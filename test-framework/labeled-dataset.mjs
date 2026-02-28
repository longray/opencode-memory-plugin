/**
 * 标注数据集
 * 用于搜索质量测试（召回率、精确率等指标）
 * 
 * 数据说明：
 * - documents: 测试文档集合，每个文档有唯一ID和内容
 * - queries: 测试查询，每个查询有期望返回的相关文档ID
 */

export const labeledDataset = {
  // 文档集合（50条手工标注的测试文档）
  documents: [
    // === 编程语言相关 (ID 1-10) ===
    { id: 1, content: "TypeScript是JavaScript的超集，添加了静态类型检查、接口、泛型等特性，可以在编译时发现类型错误", type: "long-term", tags: ["typescript", "types", "javascript"] },
    { id: 2, content: "Python是一种动态类型语言，支持类型提示（Type Hints），可以配合mypy进行静态类型检查", type: "long-term", tags: ["python", "types", "static-analysis"] },
    { id: 3, content: "JavaScript是弱类型动态语言，ES6+引入了let、const、箭头函数、解构赋值等现代特性", type: "long-term", tags: ["javascript", "es6", "dynamic"] },
    { id: 4, content: "Rust语言通过所有权系统实现内存安全，无需垃圾回收器，适合系统级编程", type: "long-term", tags: ["rust", "memory-safety", "systems"] },
    { id: 5, content: "Go语言由Google开发，强调简洁和并发，内置goroutine和channel支持", type: "long-term", tags: ["golang", "concurrency", "google"] },
    { id: 6, content: "Java是一种面向对象语言，运行在JVM上，具有跨平台、强类型、垃圾回收等特点", type: "long-term", tags: ["java", "jvm", "oop"] },
    { id: 7, content: "Kotlin是运行在JVM上的现代语言，与Java完全互操作，支持空安全、扩展函数等特性", type: "long-term", tags: ["kotlin", "jvm", "null-safety"] },
    { id: 8, content: "C++是高性能系统编程语言，支持手动内存管理、模板元编程、RAII等高级特性", type: "long-term", tags: ["cpp", "performance", "systems"] },
    { id: 9, content: "Swift是Apple开发的现代语言，用于iOS/macOS开发，结合了高性能和安全性", type: "long-term", tags: ["swift", "ios", "apple"] },
    { id: 10, content: "函数式编程语言如Haskell、Elixir强调纯函数、不可变性和高阶函数", type: "long-term", tags: ["functional", "haskell", "elixir"] },

    // === 数据库相关 (ID 11-20) ===
    { id: 11, content: "PostgreSQL是开源关系数据库，支持复杂查询、事务、JSON、全文搜索等高级特性", type: "long-term", tags: ["postgresql", "database", "sql"] },
    { id: 12, content: "MySQL是最流行的开源关系数据库，简单易用，适合Web应用，支持主从复制", type: "long-term", tags: ["mysql", "database", "sql"] },
    { id: 13, content: "Redis是内存键值数据库，支持字符串、哈希、列表、集合、有序集合等数据结构", type: "long-term", tags: ["redis", "cache", "nosql"] },
    { id: 14, content: "MongoDB是文档数据库，以BSON格式存储，支持灵活的schema和水平扩展", type: "long-term", tags: ["mongodb", "document-db", "nosql"] },
    { id: 15, content: "Elasticsearch是分布式搜索引擎，基于Lucene，支持全文搜索、聚合分析", type: "long-term", tags: ["elasticsearch", "search", "lucene"] },
    { id: 16, content: "数据库索引是加速查询的数据结构，常见的有B树索引、哈希索引、全文索引", type: "long-term", tags: ["database", "index", "optimization"] },
    { id: 17, content: "数据库事务具有ACID特性：原子性、一致性、隔离性、持久性", type: "long-term", tags: ["database", "transaction", "acid"] },
    { id: 18, content: "数据库连接池管理数据库连接，减少连接创建开销，提高性能", type: "long-term", tags: ["database", "connection-pool", "performance"] },
    { id: 19, content: "SQLite是轻量级嵌入式数据库，无需服务器，适合移动应用和小型项目", type: "long-term", tags: ["sqlite", "embedded", "database"] },
    { id: 20, content: "数据库分片是将数据分散到多个服务器的技术，用于处理大规模数据", type: "long-term", tags: ["database", "sharding", "scalability"] },

    // === 缓存相关 (ID 21-25) ===
    { id: 21, content: "缓存是提高性能的技术，将频繁访问的数据存储在快速访问的介质中", type: "long-term", tags: ["cache", "performance", "optimization"] },
    { id: 22, content: "缓存策略包括LRU（最近最少使用）、LFU（最不常用）、FIFO（先进先出）等", type: "long-term", tags: ["cache", "lru", "strategy"] },
    { id: 23, content: "缓存穿透是指查询不存在的数据，解决方案包括布隆过滤器和缓存空值", type: "long-term", tags: ["cache", "penetration", "bloom-filter"] },
    { id: 24, content: "Memcached是高性能分布式内存缓存系统，简单快速但只支持字符串", type: "long-term", tags: ["memcached", "cache", "distributed"] },
    { id: 25, content: "CDN（内容分发网络）将静态资源缓存到全球节点，加速内容访问", type: "long-term", tags: ["cdn", "cache", "distribution"] },

    // === API设计相关 (ID 26-35) ===
    { id: 26, content: "RESTful API遵循REST架构风格，使用HTTP方法（GET、POST、PUT、DELETE）操作资源", type: "long-term", tags: ["api", "rest", "http"] },
    { id: 27, content: "GraphQL是Facebook开发的API查询语言，客户端可以精确指定需要的字段", type: "long-term", tags: ["graphql", "api", "query"] },
    { id: 28, content: "gRPC是Google开发的高性能RPC框架，使用Protocol Buffers序列化，支持双向流", type: "long-term", tags: ["grpc", "rpc", "protobuf"] },
    { id: 29, content: "API认证方式包括JWT（JSON Web Token）、OAuth 2.0、API Key等", type: "long-term", tags: ["api", "authentication", "jwt"] },
    { id: 30, content: "API限流（Rate Limiting）防止API被滥用，常用算法有令牌桶和漏桶", type: "long-term", tags: ["api", "rate-limiting", "security"] },
    { id: 31, content: "API版本控制策略包括URL路径版本、查询参数版本、Header版本", type: "long-term", tags: ["api", "versioning", "design"] },
    { id: 32, content: "OpenAPI规范（Swagger）用于描述REST API，支持自动生成文档和客户端代码", type: "long-term", tags: ["openapi", "swagger", "documentation"] },
    { id: 33, content: "Webhook是一种事件驱动的API回调机制，当事件发生时主动推送数据", type: "long-term", tags: ["webhook", "api", "events"] },
    { id: 34, content: "API网关是系统的统一入口，负责路由、认证、限流、监控等功能", type: "long-term", tags: ["api-gateway", "architecture", "microservices"] },
    { id: 35, content: "幂等性确保API多次调用产生相同结果，对于POST和PUT请求很重要", type: "long-term", tags: ["api", "idempotency", "design"] },

    // === 错误处理相关 (ID 36-40) ===
    { id: 36, content: "try-catch用于捕获和处理JavaScript中的异常，确保程序不会因错误而崩溃", type: "long-term", tags: ["error-handling", "javascript", "try-catch"] },
    { id: 37, content: "错误边界（Error Boundary）是React中捕获组件错误的技术，防止整个应用崩溃", type: "long-term", tags: ["error-handling", "react", "error-boundary"] },
    { id: 38, content: "全局错误处理在应用级别捕获未处理的异常，记录日志并返回友好错误信息", type: "long-term", tags: ["error-handling", "global", "logging"] },
    { id: 39, content: "异步错误处理使用async/await配合try-catch，或Promise的catch方法", type: "long-term", tags: ["error-handling", "async", "promise"] },
    { id: 40, content: "错误监控服务如Sentry可以自动捕获、记录和通知应用中的错误", type: "long-term", tags: ["error-handling", "monitoring", "sentry"] },

    // === 测试相关 (ID 41-50) ===
    { id: 41, content: "单元测试验证单个函数或模块的行为，使用断言检查预期结果", type: "long-term", tags: ["testing", "unit-test", "assertion"] },
    { id: 42, content: "集成测试验证多个组件协同工作是否正确，涉及数据库、API等外部依赖", type: "long-term", tags: ["testing", "integration", "e2e"] },
    { id: 43, content: "测试驱动开发（TDD）先写测试再写代码，确保代码满足需求", type: "long-term", tags: ["testing", "tdd", "methodology"] },
    { id: 44, content: "Mock和Stub用于模拟外部依赖，使测试独立、快速、可控", type: "long-term", tags: ["testing", "mock", "stub"] },
    { id: 45, content: "代码覆盖率衡量测试覆盖的代码比例，包括行覆盖、分支覆盖、函数覆盖", type: "long-term", tags: ["testing", "coverage", "metrics"] },
    { id: 46, content: "端到端测试（E2E）模拟真实用户行为，验证整个应用流程", type: "long-term", tags: ["testing", "e2e", "playwright"] },
    { id: 47, content: "Jest是流行的JavaScript测试框架，支持快照测试、模拟、并行执行", type: "long-term", tags: ["testing", "jest", "javascript"] },
    { id: 48, content: "Pytest是Python测试框架，支持参数化测试、fixtures、插件扩展", type: "long-term", tags: ["testing", "pytest", "python"] },
    { id: 49, content: "性能测试评估系统响应时间、吞吐量、资源使用等指标", type: "long-term", tags: ["testing", "performance", "benchmark"] },
    { id: 50, content: "回归测试确保新代码没有破坏现有功能，通常在CI/CD流程中自动运行", type: "long-term", tags: ["testing", "regression", "ci-cd"] },
  ],

  // 查询集合（30个测试查询，包含期望的相关文档ID）
  queries: [
    // === 语义搜索测试（需要embedding理解语义）===
    { 
      id: "Q1", 
      query: "类型检查", 
      relevant: [1, 2],  // TypeScript和Python都支持类型检查
      mode: "semantic",
      description: "测试同义词理解：类型检查 -> TypeScript静态类型, Python类型提示"
    },
    { 
      id: "Q2", 
      query: "数据库选型", 
      relevant: [11, 12, 13, 14, 15, 19],  // 各种数据库
      mode: "semantic",
      description: "测试概念查询：数据库选型 -> PostgreSQL, MySQL, Redis, MongoDB等"
    },
    { 
      id: "Q3", 
      query: "如何处理错误", 
      relevant: [36, 37, 38, 39, 40],  // 错误处理相关
      mode: "semantic",
      description: "测试问题式查询"
    },
    { 
      id: "Q4", 
      query: "缓存策略", 
      relevant: [13, 21, 22, 23, 24, 25],  // Redis和各种缓存技术
      mode: "semantic",
      description: "测试概念聚合"
    },
    { 
      id: "Q5", 
      query: "API设计最佳实践", 
      relevant: [26, 29, 30, 31, 35],  // RESTful, 认证, 限流, 幂等性
      mode: "semantic",
      description: "测试最佳实践查询"
    },
    { 
      id: "Q6", 
      query: "Use Redis for caching", 
      relevant: [13, 21, 22, 24],  // 跨语言查询
      mode: "semantic",
      description: "测试跨语言查询（英文->中文结果）"
    },
    { 
      id: "Q7", 
      query: "系统编程语言", 
      relevant: [4, 8],  // Rust和C++
      mode: "semantic",
      description: "测试领域概念"
    },
    { 
      id: "Q8", 
      query: "前端开发语言", 
      relevant: [1, 3, 9],  // TypeScript, JavaScript, Swift
      mode: "semantic",
      description: "测试领域分类"
    },
    { 
      id: "Q9", 
      query: "NoSQL数据库", 
      relevant: [13, 14],  // Redis, MongoDB
      mode: "semantic",
      description: "测试分类概念"
    },
    { 
      id: "Q10", 
      query: "测试方法论", 
      relevant: [41, 42, 43, 45, 46],  // 各种测试方法
      mode: "semantic",
      description: "测试概念聚合"
    },

    // === 关键词搜索测试 ===
    { 
      id: "Q11", 
      query: "TypeScript", 
      relevant: [1],  // 精确匹配
      mode: "keyword",
      description: "测试精确关键词匹配"
    },
    { 
      id: "Q12", 
      query: "PostgreSQL", 
      relevant: [11],  // 精确匹配
      mode: "keyword",
      description: "测试精确关键词匹配"
    },
    { 
      id: "Q13", 
      query: "JWT认证", 
      relevant: [29],  // JWT和认证
      mode: "keyword",
      description: "测试组合关键词"
    },
    { 
      id: "Q14", 
      query: "错误监控 Sentry", 
      relevant: [40],  // Sentry错误监控
      mode: "keyword",
      description: "测试品牌关键词"
    },
    { 
      id: "Q15", 
      query: "Jest测试", 
      relevant: [47],  // Jest
      mode: "keyword",
      description: "测试工具名称"
    },

    // === 混合搜索测试 ===
    { 
      id: "Q16", 
      query: "并发编程", 
      relevant: [5, 28],  // Go goroutine, gRPC双向流
      mode: "hybrid",
      description: "测试语义+关键词混合"
    },
    { 
      id: "Q17", 
      query: "内存安全", 
      relevant: [4],  // Rust所有权
      mode: "hybrid",
      description: "测试特定概念"
    },
    { 
      id: "Q18", 
      query: "数据一致性", 
      relevant: [17],  // ACID
      mode: "hybrid",
      description: "测试抽象概念"
    },
    { 
      id: "Q19", 
      query: "微服务架构", 
      relevant: [34],  // API网关
      mode: "hybrid",
      description: "测试架构概念"
    },
    { 
      id: "Q20", 
      query: "查询优化", 
      relevant: [16],  // 索引
      mode: "hybrid",
      description: "测试性能优化概念"
    },

    // === 边界情况测试 ===
    { 
      id: "Q21", 
      query: "编程语言", 
      relevant: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  // 所有编程语言
      mode: "semantic",
      description: "测试宽泛查询，应该返回多个结果"
    },
    { 
      id: "Q22", 
      query: "xyz不存在的内容12345", 
      relevant: [],  // 应该返回空结果
      mode: "keyword",
      description: "测试无结果查询"
    },
    { 
      id: "Q23", 
      query: "types",  // 英文单关键词
      relevant: [1, 2],  // TypeScript, Python类型提示
      mode: "hybrid",
      description: "测试英文关键词语义理解"
    },
    { 
      id: "Q24", 
      query: "database optimization", 
      relevant: [16, 18, 20, 21],  // 索引, 连接池, 分片, 缓存
      mode: "hybrid",
      description: "测试英文查询"
    },
    { 
      id: "Q25", 
      query: "Python", 
      relevant: [2, 48],  // Python语言, Pytest
      mode: "keyword",
      description: "测试语言名称"
    },

    // === 复杂语义测试 ===
    { 
      id: "Q26", 
      query: "如何保证API安全", 
      relevant: [29, 30],  // 认证, 限流
      mode: "semantic",
      description: "测试安全问题"
    },
    { 
      id: "Q27", 
      query: "提高Web性能", 
      relevant: [18, 21, 22, 25],  // 连接池, 缓存, CDN
      mode: "semantic",
      description: "测试优化建议"
    },
    { 
      id: "Q28", 
      query: "移动应用开发", 
      relevant: [9, 19],  // Swift, SQLite
      mode: "semantic",
      description: "测试平台相关"
    },
    { 
      id: "Q29", 
      query: "REST vs GraphQL", 
      relevant: [26, 27],  // RESTful, GraphQL
      mode: "semantic",
      description: "测试对比查询"
    },
    { 
      id: "Q30", 
      query: "持续集成测试", 
      relevant: [45, 50],  // 覆盖率, 回归测试
      mode: "semantic",
      description: "测试CI/CD相关"
    },
  ],

  // 质量指标目标
  qualityTargets: {
    recallAt10: 0.70,      // Recall@10 目标 ≥ 70%
    precisionAt10: 0.50,   // Precision@10 目标 ≥ 50%
    mrr: 0.60,             // MRR 目标 ≥ 0.60
    latencyP95: 500,       // P95延迟 < 500ms
  },

  // 数据集元信息
  metadata: {
    version: "1.0.0",
    createdAt: "2026-02-28",
    totalDocuments: 50,
    totalQueries: 30,
    languages: ["zh-CN", "en-US"],
    categories: ["programming", "database", "cache", "api", "error-handling", "testing"],
    embeddingModel: "Qwen3-Embedding-0.6B",
    embeddingDimensions: 1024,
  }
};

// 导出工具函数
export function getDocumentById(id) {
  return labeledDataset.documents.find(doc => doc.id === id);
}

export function getQueryById(id) {
  return labeledDataset.queries.find(query => query.id === id);
}

export function getDocumentsByTags(tags) {
  return labeledDataset.documents.filter(doc => 
    tags.some(tag => doc.tags.includes(tag))
  );
}

export default labeledDataset;