// 调试分词不一致问题
import { tokenize, isAsciiOnly } from './lib/bm25.js';

// 模拟文档内容
const docContent = "Python是一种流行的编程语言，特别适用于数据分析。";
const searchQuery1 = "Python";
const searchQuery2 = "数据分析";

console.log("=== 分词不一致性问题分析 ===");
console.log();

console.log("文档内容:", docContent);
console.log("文档 isAsciiOnly:", isAsciiOnly(docContent));
console.log("文档分词结果:", tokenize(docContent));
console.log();

console.log("查询1:", searchQuery1);
console.log("查询1 isAsciiOnly:", isAsciiOnly(searchQuery1));
console.log("查询1分词结果:", tokenize(searchQuery1));
console.log();

console.log("查询2:", searchQuery2);
console.log("查询2 isAsciiOnly:", isAsciiOnly(searchQuery2));
console.log("查询2分词结果:", tokenize(searchQuery2));
console.log();

// 验证"Python"这个词是否在文档分词结果中
const docTokens = tokenize(docContent);
const query1Tokens = tokenize(searchQuery1);

console.log("=== 问题分析 ===");
console.log("'Python'查询词的分词结果:", query1Tokens);
console.log("文档中的分词结果:", docTokens);
console.log("查询词是否存在于文档分词结果中:", query1Tokens.some(token => docTokens.includes(token)));
console.log();

// 检查是否能从中文文本中识别出英文单词
console.log("=== jieba处理中英混合文本的行为 ===");
import { Jieba } from '@node-rs/jieba';
const jieba = Jieba.withDict();
console.log("jieba.cut(完整句子):", jieba.cut(docContent, false));
console.log("jieba.cut(纯英文词):", jieba.cut("Python", false));