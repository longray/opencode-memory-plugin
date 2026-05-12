# Symbol Table 开发者指南 (v3.3)

跨文件符号解析表，用于在代码分析过程中追踪和解析 JavaScript/TypeScript 项目中的符号引用关系。

## 概述

Symbol Table 是自动代码关系提取系统的核心组件。它维护文件路径与实体 ID（memory_id）之间的映射，以及全局符号名与实体 ID 的对应关系，使得系统能够在跨文件分析时正确解析 `import`/`require` 引用的目标。

**核心能力**:

- 🔗 **跨文件符号解析** — 解析相对路径、别名路径和 Node.js 内置模块
- 💾 **持久化存储** — 符号表自动保存到磁盘，重启后自动恢复
- ⚡ **LRU 缓存淘汰** — 超过 maxSize 时自动淘汰最少使用的条目
- 📦 **批量操作** — 支持批量设置路径映射和全局符号

## 架构

```
┌─────────────────────────────────────────────────┐
│                  CodeAnalysisService             │
│                                                  │
│  uploadProject()                                 │
│    ├── 扫描项目文件                               │
│    ├── 构建全局符号表 (globalSymbolTable)         │
│    ├── 解析 import 路径 → resolveImportPath()    │
│    ├── 提取关系 (calls, depends_on, extends)      │
│    └── 批量上传 references                        │
│                                                  │
│  buildSymbolTable() ──► 从分析结果构建符号映射     │
│  mergeSymbolTables() ──► 合并多个文件的符号表      │
└─────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────┐
│                    SymbolTable                    │
│                                                  │
│  pathToEntityId: Map<filePath, entityId>          │
│  globalNameToEntityId: Map<symbolName, entityId>  │
│  _symbolToPaths: Map<symbolName, Set<filePath>>   │
│  _entityToSymbols: Map<entityId, Set<symbolName>> │
│                                                  │
│  resolveImportPath(importPath, currentFile)       │
│  lookupByName(symbolName)                         │
│  persist() / reload()                             │
└─────────────────────────────────────────────────┘
```

## 数据结构

### SymbolTable 核心字段

| 字段                   | 类型                        | 说明                                    |
| ---------------------- | --------------------------- | --------------------------------------- |
| `projectId`            | `string`                    | 项目标识符，用于缓存隔离                |
| `cacheDir`             | `string`                    | 缓存目录（默认 `~/.opencode/cache`）    |
| `cacheFile`            | `string`                    | 缓存文件路径（`symbol-table.json`）     |
| `pathToEntityId`       | `Map<string, string>`       | 文件路径 → 实体 ID 映射                 |
| `globalNameToEntityId` | `Map<string, string>`       | 符号名 → 实体 ID 映射                   |
| `_symbolToPaths`       | `Map<string, Set<string>>`  | 符号名 → 文件路径集合（支持同名多文件） |
| `_entityToSymbols`     | `Map<string, Set<string>>`  | 实体 ID → 符号名集合（反向索引）        |
| `maxSize`              | `number`                    | 最大缓存条目数（默认 10000）            |
| `stats`                | `{hits, misses, lastSaved}` | 缓存命中率统计                          |

### 持久化格式 (`symbol-table.json`)

```json
{
  "version": "1.0",
  "project_id": "my-project",
  "last_updated": "2026-05-12T10:30:00.000Z",
  "pathToEntityId": {
    "src/utils.js": "01KRDYACHGD22ZW556RE5NENNN"
  },
  "globalNameToEntityId": {
    "formatDate": "01KRDYACHGD22ZW556RE5NENNN",
    "src/utils.js:formatDate": "01KRDYACHGD22ZW556RE5NENNN"
  },
  "symbolToPaths": {
    "formatDate": ["src/utils.js"]
  }
}
```

## API 参考

### 构造函数

```javascript
import { SymbolTable } from './lib/symbol-table.js';

const symbolTable = new SymbolTable(projectId, cacheDir, {
  pathAliases: { '@/*': 'src/*' }, // 路径别名映射
  maxSize: 10000, // 最大缓存条目数
});
```

### 核心方法

#### `resolveImportPath(importPath, currentFile)`

解析导入路径为绝对文件路径。

```javascript
// 相对路径解析
symbolTable.resolveImportPath('./utils', 'src/main.js');
// → 'src/utils' (如果文件存在)

// 别名路径解析（需配置 pathAliases）
symbolTable.resolveImportPath('@/helpers', 'src/components/App.ts');
// → 'src/helpers' (如果配置了 '@/*': 'src/*')

// Node.js 内置模块
symbolTable.resolveImportPath('fs', 'src/main.js');
// → null (内置模块无需解析)

// 第三方包
symbolTable.resolveImportPath('lodash', 'src/main.js');
// → null (第三方包不在符号表中)
```

#### `lookupByName(symbolName)`

通过符号名查找对应的实体 ID。

```javascript
const entityId = symbolTable.lookupByName('formatDate');
// → '01KRDYACHGD22ZW556RE5NENNN' 或 null
```

#### `lookupSymbolByPath(filePath)`

通过文件路径查找对应的实体 ID。

```javascript
const entityId = symbolTable.lookupSymbolByPath('src/utils.js');
// → '01KRDYACHGD22ZW556RE5NENNN' 或 null
```

#### `resolveAndLookup(importPath, currentFile)`

组合操作：先解析导入路径，再查找实体 ID。

```javascript
const entityId = symbolTable.resolveAndLookup('./utils', 'src/main.js');
// → 等价于 resolveImportPath() + lookupSymbolByPath()
```

### 写入方法

#### `setPathMapping(filePath, entityId)`

设置文件路径到实体 ID 的映射。

```javascript
await symbolTable.setPathMapping('src/utils.js', '01KRD...');
```

#### `setGlobalSymbol(symbolName, entityId, filePath)`

注册全局符号。

```javascript
await symbolTable.setGlobalSymbol('formatDate', '01KRD...', 'src/utils.js');
```

#### `setBatchPathMappings(mappings)`

批量设置路径映射。

```javascript
const mappings = new Map([
  ['src/utils.js', '01KRD...'],
  ['src/api.js', '01KRE...'],
]);
await symbolTable.setBatchPathMappings(mappings);
```

#### `setBatchGlobalSymbols(symbols)`

批量注册全局符号。

```javascript
const symbols = [
  ['formatDate', '01KRD...', 'src/utils.js'],
  ['fetchUser', '01KRE...', 'src/api.js'],
];
await symbolTable.setBatchGlobalSymbols(symbols);
```

### 持久化方法

#### `load()`

从磁盘加载缓存。

```javascript
await symbolTable.load();
// 日志: [SymbolTable] Loaded 42 path mappings, 128 global symbols
```

#### `save()`

保存到磁盘（防抖 1 秒）。

```javascript
await symbolTable.save();
// 日志: [SymbolTable] Saved 42 path mappings, 128 global symbols
```

#### `cleanup()`

清理待保存的定时器，在进程退出前调用。

```javascript
symbolTable.cleanup();
```

### 其他方法

| 方法                           | 说明                           |
| ------------------------------ | ------------------------------ |
| `hasPath(filePath)`            | 检查文件路径是否已注册         |
| `removePathMapping(path)`      | 移除路径映射                   |
| `invalidatePath(path)`         | 使路径及其关联符号失效         |
| `clear()`                      | 清空所有数据                   |
| `getStats()`                   | 获取缓存统计（命中率、条目数） |
| `getBatchPathEntityIds(paths)` | 批量查询路径对应的实体 ID      |

## 与 uploadProject 的集成

`uploadProject` 是 `CodeAnalysisService` 的核心方法，负责分析整个项目并上传结果。符号表在其中扮演关键角色：

### 工作流程

```
uploadProject(projectRoot)
    │
    ├── 1. 扫描项目文件（按扩展名过滤）
    │
    ├── 2. 第一轮：分析所有文件，构建符号表
    │     ├── 对每个文件执行 AST 分析
    │     ├── buildSymbolTable(filePath, result, entityId)
    │     │     └── 提取 exports → 注册到 globalNameToEntityId
    │     ├── mergeSymbolTables(tables)
    │     └── 建立 pathToEntityId 映射
    │
    ├── 3. 第二轮：解析关系，提取引用
    │     ├── 对每个文件的 imports 调用 resolveImportPath()
    │     ├── 通过 globalSymbolTable 查找目标实体 ID
    │     ├── 提取关系类型：
    │     │     ├── depends_on  — import/require 依赖
    │     │     ├── calls       — 函数调用
    │     │     ├── extends     — 类继承
    │     │     └── implements  — 接口实现
    │     └── 构建 references 数组
    │
    └── 4. 批量上传到后端
          └── client.uploadReferencesBatch(refs)
```

### 关键代码片段

```javascript
// code-analysis-service.js 中的符号表使用
class CodeAnalysisService {
  async uploadProject(projectRoot, options = {}) {
    // 第一轮：构建全局符号表
    const globalSymbolTable = {
      pathToEntityId: new Map(),
      globalNameToEntityId: new Map(),
    };

    for (const file of files) {
      const analysis = await this.analyzeFile(file);
      const table = this.buildSymbolTable(file, analysis, entityId);
      this.mergeSymbolTables(globalSymbolTable, table);
    }

    // 第二轮：使用符号表解析关系
    for (const file of files) {
      const relations = this.extractRelations(file, analysis, {
        globalSymbolTable,
        resolveImportPath: (imp, current) =>
          this.resolveImportPath(imp, current, globalSymbolTable),
      });
      // 上传 relations...
    }
  }
}
```

## 使用示例

### 示例 1：基本使用

```javascript
import { SymbolTable } from './lib/symbol-table.js';

// 创建符号表
const st = new SymbolTable('my-project');

// 加载缓存
await st.load();

// 注册文件映射
await st.setPathMapping('src/utils.js', 'entity-001');
await st.setGlobalSymbol('formatDate', 'entity-001', 'src/utils.js');

// 查询
console.log(st.lookupSymbolByPath('src/utils.js'));
// → 'entity-001'

console.log(st.lookupByName('formatDate'));
// → 'entity-001'

// 解析导入
const resolved = st.resolveImportPath('./utils', 'src/main.js');
console.log(resolved);
// → 'src/utils' (如果文件存在)
```

### 示例 2：配置路径别名

```javascript
const st = new SymbolTable('my-project', null, {
  pathAliases: {
    '@components/*': 'src/components/*',
    '@utils': 'src/utils/index.js',
    '~/*': 'src/*',
  },
});

// 解析别名
const path = st.resolveImportPath('@components/Button', 'src/App.js');
// → 'src/components/Button'
```

### 示例 3：批量操作

```javascript
// 批量注册
const pathMappings = new Map([
  ['src/a.js', 'id-a'],
  ['src/b.js', 'id-b'],
  ['src/c.js', 'id-c'],
]);
await st.setBatchPathMappings(pathMappings);

// 批量查询
const filePaths = ['src/a.js', 'src/b.js', 'src/nonexistent.js'];
const results = st.getBatchPathEntityIds(filePaths);
// → Map { 'src/a.js' => 'id-a', 'src/b.js' => 'id-b' }
```

### 示例 4：查看统计信息

```javascript
const stats = st.getStats();
console.log(stats);
// {
//   pathEntries: 42,
//   globalEntries: 128,
//   maxSize: 10000,
//   hits: 356,
//   misses: 44,
//   hitRate: '89.00%',
//   lastSaved: '2026-05-12T10:30:00.000Z'
// }
```

## 路径解析规则

### 相对路径 (`./` 或 `../`)

1. 基于当前文件所在目录解析
2. 尝试添加扩展名：`.js`, `.ts`, `.mjs`, `.cjs`
3. 如果是目录，尝试 `index.js`
4. Windows 路径自动规范化（`\` → `/`）

### 别名路径 (`@xxx`)

1. 匹配 `pathAliases` 配置
2. 支持通配符：`@/*` → `src/*`
3. 未匹配则返回 `null`

### Node.js 内置模块

- 使用 `module.builtinModules` 检测
- 内置模块返回 `null`（无需解析）
- 支持 `node:` 前缀

### 第三方包

- npm 包返回 `null`（不在符号表中）
- 由后端或外部系统处理

## 注意事项

1. **缓存位置**: 符号表缓存在 `~/.opencode/cache/symbol-table.json`，不属于项目文件，不会被 git 跟踪
2. **项目隔离**: 不同项目的符号表通过 `project_id` 隔离，加载时会校验项目 ID 是否匹配
3. **LRU 淘汰**: 当总条目数超过 `maxSize` 时，最少使用的条目会被自动淘汰
4. **防抖保存**: 修改后 1 秒自动保存，避免频繁磁盘 I/O
5. **路径规范化**: 所有路径统一使用 `/` 分隔符，Windows 路径会自动转换

---

**最后更新**: 2026-05-12  
**版本**: v3.3.0
