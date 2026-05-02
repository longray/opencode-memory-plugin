import { writeMemory } from "../../../../opencode-memory-plugin/lib/memory-core.js";
import { getEntryById } from "../../../../opencode-memory-plugin/lib/storage.js";

const ATOMS = [
  {
    local_id: "01KEVAL01CH00000000000001",
    type: "chapter",
    name: "第1章：Promise 基础",
    content:
      'Promise 是 JavaScript 异步编程的基石。它代表一个可能还未完成的操作，提供三种状态：pending（等待中）、fulfilled（已兑现）和 rejected（已拒绝）。状态一旦变更就不可逆转，这被称为"settled"。Promise 构造器接收一个 executor 函数，该函数拥有 resolve 和 reject 两个参数，用于控制 Promise 的最终状态。',
    order: "a0",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL01SE00000000000001",
        type: "section",
        name: "1.1 Promise 状态机",
        content:
          'Promise 状态机是理解异步行为的核心。一个 Promise 只能处于三种状态之一：pending → fulfilled 或 pending → rejected。一旦 settled，就永远不会再变化。这个特性保证了回调只会被调用一次。\n\n```javascript\nconst p = new Promise((resolve, reject) => {\n  // pending 状态\n  setTimeout(() => resolve("done"), 1000);\n  // 1秒后变为 fulfilled\n});\n\nconsole.log(p.state); // pending\nsetTimeout(() => console.log(p.state), 1100); // fulfilled\n```\n\n状态转换图：\n```\npending ──resolve()──> fulfilled\n  │\n  └──reject()───> rejected\n```',
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000001",
        children: [],
      },
      {
        local_id: "01KEVAL01SE00000000000002",
        type: "section",
        name: "1.2 then/catch/finally 链",
        content:
          'Promise 链式调用是处理异步流程的核心模式。then() 注册 fulfilled 回调，catch() 捕获 rejected，finally() 无论结果如何都会执行。每个 then 返回新的 Promise，形成链式调用。详见 [[01KEVAL01SE00000000000005]] 了解 async/await 中更优雅的错误处理方式。\n\n```javascript\nfetchUser(id)\n  .then(user => fetchPosts(user.id))\n  .then(posts => console.log(posts))\n  .catch(err => console.error("请求失败:", err))\n  .finally(() => console.log("请求结束"));\n```\n\n链式调用中，任何一步抛出错误都会跳过后续 then，直接进入最近的 catch。finally 不会改变 Promise 的值，但可以用于清理资源。',
        order: "a1",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000001",
        children: [],
      },
      {
        local_id: "01KEVAL01SE00000000000003",
        type: "section",
        name: "1.3 Promise 组合方法",
        content:
          "Promise 提供了四种组合方法来处理多个异步操作：Promise.all()、Promise.race()、Promise.allSettled() 和 Promise.any()。选择合适的方法取决于业务需求。详见 [[01KEVAL01SE00000000000006]] 了解并发控制的高级技巧。\n\n```javascript\n// Promise.all - 全部成功才成功\nconst [users, posts] = await Promise.all([\n  fetchUsers(), fetchPosts()\n]);\n\n// Promise.race - 返回最快的\nconst fastest = await Promise.race([\n  fetchFromCDN(), fetchFromOrigin()\n]);\n```\n\n组合方法速查：all（全部成功）、race（最快）、allSettled（全部完成）、any（最快成功）。",
        order: "a2",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000001",
        children: [
          {
            local_id: "01KEVAL01NT00000000000001",
            type: "note",
            name: "Promise.all 详解",
            content:
              "Promise.all 接收一组 Promise，当所有 Promise 都 fulfilled 时返回结果数组；任一 rejected 则立即 reject。结果顺序与输入顺序一致。错误处理建议配合 try/catch 或 .catch()。",
            order: "a0",
            heading_level: 3,
            parent_id: "01KEVAL01SE00000000000003",
            children: [],
          },
          {
            local_id: "01KEVAL01NT00000000000002",
            type: "note",
            name: "Promise.race vs allSettled",
            content:
              "Promise.race 返回最先 settled 的结果（无论成功失败），适合超时控制。Promise.allSettled 等待所有 Promise 完成，返回每项的状态和值/原因，适合需要知道每个请求结果的场景。",
            order: "a1",
            heading_level: 3,
            parent_id: "01KEVAL01SE00000000000003",
            children: [],
          },
        ],
      },
    ],
  },
  {
    local_id: "01KEVAL01CH00000000000002",
    type: "chapter",
    name: "第2章：async/await",
    content:
      "async/await 是 ES2017 引入的语法糖，让异步代码看起来像同步代码。async 函数始终返回 Promise，await 暂停函数执行直到 Promise settled。它极大提升了异步代码的可读性，是现代 JavaScript 异步编程的主流方式。详见 [[01KEVAL01SE00000000000004]] 了解基本语法。",
    order: "a1",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL01SE00000000000004",
        type: "section",
        name: "2.1 async 函数语法",
        content:
          "async 关键字标记函数为异步函数，自动将返回值包装为 Promise。await 只能在 async 函数内使用，暂停执行直到右侧表达式 resolve。如果表达式 reject，await 会抛出错误。详见 [[01KEVAL01SE00000000000008]] 了解如何取消异步操作。\n\n```javascript\nasync function getUser(id) {\n  const response = await fetch(`/api/users/${id}`);\n  const user = await response.json();\n  return user;\n}\n\n// 等价于\nfunction getUser(id) {\n  return fetch(`/api/users/${id}`)\n    .then(res => res.json());\n}\n```\n\nawait 的错误可以用 try/catch 捕获，比 .catch() 链更直观。",
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000002",
        children: [],
      },
      {
        local_id: "01KEVAL01SE00000000000005",
        type: "section",
        name: "2.2 错误处理最佳实践",
        content:
          "async/await 中的错误处理有多种模式。最推荐的是 try/catch 包裹 await，因为它和同步代码的写法一致。也可以使用 Promise 的 .catch() 或封装一个通用的错误处理函数。详见 [[01KEVAL01SE00000000000002]] 了解 Promise 链式错误处理。\n\n```javascript\nasync function safeFetch(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(`HTTP ${res.status}`);\n    return await res.json();\n  } catch (err) {\n    console.error(`请求 ${url} 失败:`, err.message);\n    return null;\n  }\n}\n```\n\n对于多个独立请求，建议用 Promise.allSettled 而非 try/catch，避免一个失败导致全部中断。",
        order: "a1",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000002",
        children: [],
      },
      {
        local_id: "01KEVAL01SE00000000000006",
        type: "section",
        name: "2.3 并发控制",
        content:
          "当需要同时发起大量请求时，不加控制会导致资源耗尽或触发服务端限流。并发控制通过限制同时执行的 Promise 数量来解决这个问题。详见 [[01KEVAL01SE00000000000003]] 了解 Promise 组合方法的基础用法。\n\n```javascript\nasync function parallelLimit(tasks, limit = 5) {\n  const results = [];\n  const executing = new Set();\n\n  for (const task of tasks) {\n    const p = task().then(r => { executing.delete(p); return r; });\n    executing.add(p);\n    results.push(p);\n    if (executing.size >= limit) {\n      await Promise.race(executing);\n    }\n  }\n  return Promise.all(results);\n}\n```",
        order: "a2",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000002",
        children: [
          {
            local_id: "01KEVAL01NT00000000000003",
            type: "note",
            name: "并行 vs 串行",
            content:
              "并行（Promise.all）所有请求同时发出，总耗时等于最慢的那个。串行（await 循环）每个请求等前一个完成才发，总耗时等于所有请求之和。根据依赖关系选择策略。",
            order: "a0",
            heading_level: 3,
            parent_id: "01KEVAL01SE00000000000006",
            children: [],
          },
          {
            local_id: "01KEVAL01NT00000000000004",
            type: "note",
            name: "限流与并发数控制",
            content:
              "实际项目中推荐使用 p-limit 或 bottleneck 库进行限流。核心思路：维护一个执行池，池满时等待任意一个完成后再添加新任务。并发数建议设为 5-10，具体取决于服务端承受能力。",
            order: "a1",
            heading_level: 3,
            parent_id: "01KEVAL01SE00000000000006",
            children: [],
          },
        ],
      },
    ],
  },
  {
    local_id: "01KEVAL01CH00000000000003",
    type: "chapter",
    name: "第3章：高级模式",
    content:
      "掌握 Promise 和 async/await 基础后，本章介绍更高级的异步模式：异步迭代器用于处理流式数据，AbortController 用于取消长时间运行的异步操作。这些模式在 Node.js 服务端和现代前端开发中越来越重要。",
    order: "a2",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL01SE00000000000007",
        type: "section",
        name: "3.1 异步迭代器",
        content:
          '异步迭代器（Async Iterator）允许逐个处理异步产生的数据。Symbol.asyncIterator 协议使 for await...of 循环可以消费异步数据流，如分页 API、文件流、WebSocket 消息等。\n\n```javascript\nasync function* fetchPages(url) {\n  let page = 1;\n  while (true) {\n    const res = await fetch(`${url}?page=${page}`);\n    const data = await res.json();\n    if (data.items.length === 0) return;\n    yield data.items;\n    page++;\n  }\n}\n\nfor await (const items of fetchPages("/api/posts")) {\n  console.log(`获取 ${items.length} 条`);\n}\n```\n\n异步生成器函数（async function*）结合 for await...of 是处理分页数据的优雅方式。',
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000003",
        children: [],
      },
      {
        local_id: "01KEVAL01SE00000000000008",
        type: "section",
        name: "3.2 取消与超时",
        content:
          'AbortController 是浏览器和 Node.js 内置的取消机制。通过 AbortSignal 可以取消 fetch 请求、超时控制、事件监听等。详见 [[01KEVAL01SE00000000000004]] 了解 async 函数的基本语法。\n\n```javascript\nconst controller = new AbortController();\nconst timeoutId = setTimeout(() => controller.abort(), 5000);\n\ntry {\n  const res = await fetch(url, { signal: controller.signal });\n  const data = await res.json();\n} catch (err) {\n  if (err.name === "AbortError") {\n    console.log("请求超时或被取消");\n  }\n} finally {\n  clearTimeout(timeoutId);\n}\n```\n\nAbortSignal 还支持 abort reason（取消原因）和 abort().throwIfAborted() 等高级用法。',
        order: "a1",
        heading_level: 2,
        parent_id: "01KEVAL01CH00000000000003",
        children: [],
      },
    ],
  },
];

async function main() {
  console.log("Creating seed data for v3.3 evaluation...\n");

  const result = await writeMemory({
    abstract:
      "JavaScript 异步编程完全指南，涵盖 Promise、async/await、并发控制和高级模式",
    overview:
      "本指南系统讲解 JavaScript 异步编程，从 Promise 基础到 async/await 语法，再到并发控制和高级模式（异步迭代器、取消机制）。每个主题配有代码示例和跨章节引用。",
    content:
      "JavaScript 异步编程完全指南。涵盖 Promise 状态机、then/catch/finally 链、Promise 组合方法、async/await 语法、错误处理、并发控制、异步迭代器以及 AbortController 取消机制。",
    type: "long-term",
    tags: ["javascript", "async", "promise", "async-await", "concurrency"],
    pinned: false,
    atoms: ATOMS,
    _source: "evaluation-seed",
  });

  if (!result.success) {
    console.error("Failed to create seed data:", result.message);
    process.exit(1);
  }

  console.log("Seed data created successfully!");
  console.log(`  Entry ID: ${result.localId}`);
  console.log(`  File: ${result.filePath}`);

  if (result.memoryId) {
    console.log(`  Memory ID: ${result.memoryId}`);
  }

  const entry = getEntryById(result.localId);
  if (entry) {
    console.log(`\nVerification: entry found in link-map`);
    if (entry.atoms) {
      console.log(`  Atoms count: ${entry.atoms.length}`);
      for (const atom of entry.atoms) {
        console.log(`    - ${atom.local_id} [${atom.type}] ${atom.name}`);
      }
    }
  } else {
    console.warn(
      "\nWarning: entry not found via getEntryById (link-map may need refresh)",
    );
  }
}

main().catch(console.error);
