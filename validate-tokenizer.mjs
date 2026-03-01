// 验证分词函数的正确性
import { tokenize } from './opencode-memory-plugin/lib/bm25.js';

console.log("=== 分词函数验证 ===");

// 测试文档内容
const docPython = "Python是一种动态类型语言，支持类型提示（Type Hints），可以配合mypy进行静态类型检查";
const docJwt = "API认证方式包括JWT（JSON Web Token）、OAuth 2.0、API Key等";
const docJest = "Jest是流行的JavaScript测试框架，支持快照测试、模拟、并行执行";

// 测试查询
const queryPython = "Python";
const queryJwt = "JWT认证";
const queryJest = "Jest测试";

console.log("\n--- 文档分词 ---");
console.log("Python文档:", tokenize(docPython));
console.log("JWT文档:", tokenize(docJwt));
console.log("Jest文档:", tokenize(docJest));

console.log("\n--- 查询分词 ---");
console.log("Python查询:", tokenize(queryPython));
console.log("JWT认证查询:", tokenize(queryJwt));
console.log("Jest测试查询:", tokenize(queryJest));

console.log("\n--- 匹配分析 ---");
const pythonDocTokens = tokenize(docPython);
const pythonQueryTokens = tokenize(queryPython);
console.log("Python查询词是否在文档中:", pythonQueryTokens.some(token => pythonDocTokens.includes(token)));

const jwtDocTokens = tokenize(docJwt);
const jwtQueryTokens = tokenize(queryJwt);
console.log("JWT认证查询词是否在JWT文档中:", jwtQueryTokens.some(token => jwtDocTokens.includes(token)));

// 检查是否JWT在文档中有
const hasJwtInDoc = jwtDocTokens.includes('jwt');
console.log("JWT文档是否包含'jwt':", hasJwtInDoc);

// 特别分析JWT认证的分词
console.log("\n--- JWT认证详细分析 ---");
console.log("JWT认证查询词分词:", tokenize("JWT认证"));
console.log("JWT分词:", tokenize("JWT"));
console.log("认证分词:", tokenize("认证"));

// 文档中JWT部分
const docTokensContainingJwt = jwtDocTokens.filter(token => token.includes('jwt'));
console.log("JWT文档中包含jwt的词汇:", docTokensContainingJwt);