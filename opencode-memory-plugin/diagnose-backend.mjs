import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

console.log('诊断插件后端调用问题\n');
console.log('========================\n');

// 1. 检查配置文件路径
console.log('1. 配置文件路径:');
console.log(`   ${CONFIG_FILE}`);
console.log(`   存在: ${fs.existsSync(CONFIG_FILE)}`);
console.log();

// 2. 读取配置文件
console.log('2. 配置文件内容:');
try {
  const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = JSON.parse(content);
  console.log(`   版本: ${config.version}`);
  console.log(`   Backend 配置:`, config.backend);
  console.log(`   Backend enabled: ${config.backend?.enabled}`);
  console.log(`   Backend URL: ${config.backend?.url}`);
  console.log(`   Backend tenant: ${config.backend?.tenant_id}`);
  console.log();
  
  // 3. 检查条件
  console.log('3. 条件检查:');
  const configLoaded = config !== null;
  const backendEnabled = config?.backend?.enabled !== false;
  console.log(`   Config 加载成功: ${configLoaded}`);
  console.log(`   Backend enabled: ${backendEnabled}`);
  console.log(`   应该调用后端: ${configLoaded && backendEnabled}`);
} catch (e) {
  console.log(`   错误: ${e.message}`);
}

console.log('\n4. 可能的问题:');
console.log('   - 如果 Config 加载失败: 配置文件格式错误');
console.log('   - 如果 Backend enabled 为 false: 配置中 backend.enabled = false');
console.log('   - 如果 OpenCode 没有显示 Backend 状态: 可能加载的是缓存版本');
