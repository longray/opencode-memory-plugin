import { WrapperClient } from "../../../../opencode-memory-plugin/lib/wrapper-client.js";
import { getConfig } from "../../../../opencode-memory-plugin/lib/storage.js";

// Initialize WrapperClient for direct API calls
const config = getConfig();
const client = new WrapperClient(config);

// ============================================================
// Entity 1: JavaScript 异步编程完全指南 (原始，不可修改)
// ============================================================
const ENTITY1_ATOMS = [
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

// ============================================================
// Entity 2: Vue 3 Composition API 指南
// ============================================================
const ENTITY2_ATOMS = [
  {
    local_id: "01KEVAL02CH00000000000001",
    type: "chapter",
    name: "第1章：setup 函数",
    content:
      "setup() 是 Vue 3 Composition API 的入口函数。它在组件创建之前执行，此时 props 已经被解析，是访问响应式数据、计算属性、生命周期钩子等的起点。setup 接收 props 和 context 两个参数，返回的对象属性将暴露给模板。在 Vue 3.3+ 中，`<script setup>` 语法糖使 setup 的使用更加简洁，无需显式 return。详见 [[01KEVAL02SE00000000000001]] 了解 setup 返回值与模板绑定的机制。",
    order: "a0",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL02SE00000000000001",
        type: "section",
        name: "1.1 setup 返回值与模板绑定",
        content:
          "setup() 返回的所有属性（包括 ref、reactive、computed、方法等）都会自动暴露给模板。这是 Composition API 的核心机制：通过返回值将逻辑组织成独立的功能单元。\n\n```javascript\nimport { ref } from 'vue';\n\nexport default {\n  setup() {\n    const count = ref(0);\n    const increment = () => count.value++;\n    return { count, increment };\n  }\n};\n```\n\n模板中直接使用 `<button @click=\"increment\">{{ count }}</button>`。注意 ref 在模板中自动解包，不需要 .value。",
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL02CH00000000000001",
        children: [],
      },
    ],
  },
  {
    local_id: "01KEVAL02CH00000000000002",
    type: "chapter",
    name: "第2章：ref 与 reactive",
    content:
      "Vue 3 提供了 ref 和 reactive 两种创建响应式数据的方式。ref 适用于基础类型值（string、number、boolean），通过 .value 访问；reactive 适用于对象类型，直接访问属性即可。选择 ref 还是 reactive 取决于数据结构和使用场景，ref 更灵活且在 `<script setup>` 中使用更简洁。详见 [[01KEVAL02SE00000000000002]] 了解 ref 的解包机制。",
    order: "a1",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL02SE00000000000002",
        type: "section",
        name: "2.1 ref 解包规则",
        content:
          "ref 在模板中自动解包（无需 .value），在 reactive 对象中也会自动解包，但在普通 JS 对象中需要手动 .value。这种差异化行为是初学者常见的困惑点。\n\n```javascript\nconst count = ref(0);\nconst state = reactive({ count }); // ref 在 reactive 中自动解包\nconsole.log(state.count); // 0，不需要 .value\n\nconst plain = { count };\nconsole.log(plain.count.value); // 需要手动 .value\n```\n\n数组中使用 ref 时也需要注意：`arr[0].value` 而非 `arr[0]`，因为数组不是 reactive 包装的。",
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL02CH00000000000002",
        children: [],
      },
    ],
  },
  {
    local_id: "01KEVAL02CH00000000000003",
    type: "chapter",
    name: "第3章：computed 与 watch",
    content:
      "computed 用于定义基于其他响应式数据的派生值，具有缓存特性——只有依赖变化时才会重新计算。watch 和 watchEffect 用于观察响应式数据变化并执行副作用。computed 返回只读的 ref，watch 更灵活（可配置 immediate、deep、flush），watchEffect 自动追踪依赖。详见 [[01KEVAL02SE00000000000003]] 了解 watchEffect 的自动依赖收集。",
    order: "a2",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL02SE00000000000003",
        type: "section",
        name: "3.1 watchEffect 自动依赖收集",
        content:
          "watchEffect 立即运行一个函数，同时自动追踪函数内使用的响应式依赖。当依赖变化时重新执行。相比 watch，watchEffect 不需要显式指定监听源，适合副作用逻辑简单、依赖明确的场景。\n\n```javascript\nimport { ref, watchEffect } from 'vue';\n\nconst searchQuery = ref('');\n\nwatchEffect(() => {\n  // 自动追踪 searchQuery.value\n  console.log('搜索:', searchQuery.value);\n  // 也可以发起 API 请求\n  fetchResults(searchQuery.value);\n});\n```\n\n注意：watchEffect 在组件卸载时自动停止。在 setup 外使用需手动调用返回的 stop 函数。",
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL02CH00000000000003",
        children: [],
      },
    ],
  },
  {
    local_id: "01KEVAL02CH00000000000004",
    type: "chapter",
    name: "第4章：生命周期钩子",
    content:
      "Composition API 通过 on 前缀的函数来注册生命周期钩子：onMounted、onUpdated、onUnmounted、onBeforeMount 等。这些函数在 setup 中调用，将回调注册到对应的生命周期阶段。与 Options API 的 beforeCreate 和 created 对应的逻辑直接写在 setup 中即可。详见 [[01KEVAL02SE00000000000004]] 了解 onMounted 的典型使用场景。",
    order: "a3",
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: "01KEVAL02SE00000000000004",
        type: "section",
        name: "4.1 onMounted 使用场景",
        content:
          "onMounted 在组件 DOM 挂载完成后执行，是发起初始 API 请求、操作 DOM 元素、设置事件监听、初始化第三方库的最佳时机。一个组件可以多次调用 onMounted，回调按注册顺序执行。\n\n```javascript\nimport { ref, onMounted, onUnmounted } from 'vue';\n\nexport default {\n  setup() {\n    const data = ref(null);\n    let timer;\n\n    onMounted(async () => {\n      data.value = await fetch('/api/data').then(r => r.json());\n      timer = setInterval(poll, 5000);\n    });\n\n    onUnmounted(() => clearInterval(timer));\n    return { data };\n  }\n};\n```\n\n最佳实践：在 onUnmounted 中清理 onMounted 中创建的资源（定时器、事件监听、WebSocket 连接等）。",
        order: "a0",
        heading_level: 2,
        parent_id: "01KEVAL02CH00000000000004",
        children: [],
      },
    ],
  },
];

// ============================================================
// Entity 3: Node.js 流式处理架构指南
// ============================================================
const ENTITY3_ATOMS = [
  {
    local_id: "01KEVAL03CH00000000000001",
    type: "chapter",
    name: "第1章：Readable 流",
    content:
      "Readable 流是数据的来源抽象，支持两种消费模式：流动模式（flowing）和暂停模式（paused）。流动模式下数据自动从底层系统读取并通过事件发射；暂停模式下需要显式调用 read() 方法。Node.js 中的 fs.createReadStream、HTTP IncomingMessage、process.stdin 都是 Readable 流的实现。Readable 流是理解 Node.js 流式处理的基础，详见 [[01KEVAL03SE00000000000001]] 了解 pipe 方法如何简化流的连接。",
    order: "a0",
    heading_level: 1,
    parent_id: null,
    children: [],
  },
  {
    local_id: "01KEVAL03CH00000000000002",
    type: "chapter",
    name: "第2章：Writable 流",
    content:
      "Writable 流是数据的目的地抽象，提供了 write()、end()、finish 等方法。写入操作内部维护了一个缓冲区队列，当 write() 返回 false 时表示缓冲区已满，此时应暂停读取。Writable 流常用于文件写入（fs.createWriteStream）、HTTP 响应、TCP socket、进程标准输出等场景。详见 [[01KEVAL03SE00000000000002]] 了解背压处理的核心机制。",
    order: "a1",
    heading_level: 1,
    parent_id: null,
    children: [],
  },
  {
    local_id: "01KEVAL03CH00000000000003",
    type: "chapter",
    name: "第3章：Transform 流",
    content:
      "Transform 流是 Duplex 流的特殊形式，在读取和写入之间对数据进行转换。它同时实现了 Readable 和 Writable 接口，数据从 Writable 端流入，经过 _transform() 方法处理后从 Readable 端流出。常见的 Transform 流包括 zlib（压缩/解压）、crypto（加密/解密）、StringDecoder（编码转换）以及自定义数据处理管道。详见 [[01KEVAL03SE00000000000003]] 了解流式处理的错误处理策略。",
    order: "a2",
    heading_level: 1,
    parent_id: null,
    children: [],
  },
  {
    local_id: "01KEVAL03SE00000000000001",
    type: "section",
    name: "3.1 pipe 方法与管道连接",
    content:
      "pipe() 是连接 Readable 和 Writable 流的便捷方法，自动管理数据流和背压。`readable.pipe(writable)` 将 readable 的输出导入 writable，并处理背压（当 writable 缓冲区满时自动暂停 readable）。还支持链式管道：`readable.pipe(transform).pipe(writable)`。\n\n```javascript\nconst fs = require('fs');\nconst zlib = require('zlib');\n\nfs.createReadStream('input.txt')\n  .pipe(zlib.createGzip())\n  .pipe(fs.createWriteStream('output.txt.gz'));\n```\n\npipe 返回目标流，支持链式调用。调用 pipe 时会自动处理 data/end/error 事件。",
    order: "a0",
    heading_level: 2,
    parent_id: "01KEVAL03CH00000000000001",
    children: [],
  },
  {
    local_id: "01KEVAL03SE00000000000002",
    type: "section",
    name: "3.2 背压处理机制",
    content:
      "背压是流式处理的核心概念：当消费者处理速度跟不上生产者时，通过信号机制让生产者暂停，避免内存溢出。Writable 流的 write() 返回 false 表示内部缓冲区已满（默认 highWaterMark 为 16KB），触发 'drain' 事件后可以继续写入。详见 [[01KEVAL03CH00000000000002]] 了解 Writable 流的缓冲区机制。\n\n```javascript\nfunction write(stream, data) {\n  if (!stream.write(data)) {\n    return new Promise(resolve => stream.once('drain', resolve));\n  }\n  return Promise.resolve();\n}\n\nasync function writeAll(stream, items) {\n  for (const item of items) {\n    await write(stream, JSON.stringify(item) + '\\n');\n  }\n  stream.end();\n}\n```",
    order: "a1",
    heading_level: 2,
    parent_id: "01KEVAL03CH00000000000002",
    children: [],
  },
  {
    local_id: "01KEVAL03SE00000000000003",
    type: "section",
    name: "3.3 流式错误处理",
    content:
      "流式处理中的错误传播与普通 try/catch 不同。如果 Readable 流发生错误，通过 pipe 连接的下游 Writable 流不会自动收到通知。推荐使用 pipeline() 替代 pipe()，它会自动传播错误并正确清理所有流资源。详见 [[01KEVAL03CH00000000000003]] 了解 Transform 流的错误处理。\n\n```javascript\nconst { pipeline } = require('stream/promises');\n\ntry {\n  await pipeline(\n    fs.createReadStream('input.txt'),\n    zlib.createGzip(),\n    fs.createWriteStream('output.gz')\n  );\n  console.log('管道完成');\n} catch (err) {\n  console.error('管道失败:', err);\n}\n```\n\npipeline 自动处理：错误传播、流销毁、文件描述符关闭。",
    order: "a2",
    heading_level: 2,
    parent_id: "01KEVAL03CH00000000000003",
    children: [],
  },
];

// ============================================================
// Entity 4: Git 分支管理策略对比指南
// ============================================================
const ENTITY4_ATOMS = [
  {
    local_id: "01KEVAL04CH00000000000001",
    type: "chapter",
    name: "第1章：GitFlow",
    content:
      "GitFlow 是最经典的分支管理模型，由 Vincent Driessen 于 2010 年提出。它定义了 master、develop、feature、release、hotfix 五种分支类型，每个分支有明确的职责和生命周期。GitFlow 适合发布周期较长的项目（如企业级 SaaS），能清晰区分开发、测试和生产环境。缺点是分支数量多、合并流程复杂，不适合持续部署。详见 [[01KEVAL04SE00000000000001]] 了解 feature 分支的具体使用规范。",
    order: "a0",
    heading_level: 1,
    parent_id: null,
    children: [],
  },
  {
    local_id: "01KEVAL04CH00000000000002",
    type: "chapter",
    name: "第2章：GitHub Flow",
    content:
      "GitHub Flow 是 GitHub 推荐的简化分支模型，只有 main 分支和 feature 分支两种。开发流程：从 main 拉分支 → 开发 → 创建 Pull Request → Code Review → 合并到 main → 立即部署。GitHub Flow 适合持续部署的 Web 应用，强调快速迭代和 Code Review。相比 GitFlow，它大幅减少了分支管理的复杂度。详见 [[01KEVAL04SE00000000000002]] 了解 release 分支在 GitHub Flow 中的替代方案。",
    order: "a1",
    heading_level: 1,
    parent_id: null,
    children: [],
  },
  {
    local_id: "01KEVAL04CH00000000000003",
    type: "chapter",
    name: "第3章：Trunk-Based Development",
    content:
      "Trunk-Based Development（主干开发）是 Google、Facebook 等大型互联网公司采用的模式。所有开发者直接在 main（trunk）上提交，通过 Feature Flag 控制未完成功能的可见性。短命分支（不超过一天）用于 Code Review。Trunk-Based 强调频繁集成（每天多次提交到主干）、自动化测试（CI/CD 全覆盖）和渐进式发布。详见 [[01KEVAL04SE00000000000003]] 了解 hotfix 在 Trunk-Based 模式下的处理方式。",
    order: "a2",
    heading_level: 1,
    parent_id: null,
    children: [],
  },
  {
    local_id: "01KEVAL04SE00000000000001",
    type: "section",
    name: "3.1 feature 分支开发规范",
    content:
      "feature 分支从 develop 分支创建，用于开发新功能。命名约定：feature/用户故事编号-简短描述（如 feature/PROJ-123-user-auth）。开发完成后通过 Pull Request/Merge Request 合并回 develop 分支。feature 分支的生命周期应尽量短（一般不超过 2 周），避免长期分支导致的合并冲突。详见 [[01KEVAL04CH00000000000001]] 了解 GitFlow 的完整分支体系。\n\n```\ngit checkout develop\ngit checkout -b feature/PROJ-123-user-auth\n# ... 开发 ...\ngit checkout develop\ngit merge --no-ff feature/PROJ-123-user-auth\n```",
    order: "a0",
    heading_level: 2,
    parent_id: "01KEVAL04CH00000000000001",
    children: [],
  },
  {
    local_id: "01KEVAL04SE00000000000002",
    type: "section",
    name: "3.2 release 分支管理",
    content:
      "release 分支用于准备新版本发布，从 develop 分支创建。在 release 分支上只允许 bug 修复、版本号更新和文档更新，不允许添加新功能。测试通过后同时合并到 master（打 tag）和 develop。GitHub Flow 不需要独立的 release 分支，通过 GitHub Releases 和 Tag 管理发布。详见 [[01KEVAL04CH00000000000002]] 了解 GitHub Flow 的简化发布流程。\n\n```\n# GitFlow release 流程\ngit checkout -b release/1.2.0 develop\n# 修复 bug、更新版本号\ngit checkout master && git merge --no-ff release/1.2.0\ngit tag -a v1.2.0\ngit checkout develop && git merge --no-ff release/1.2.0\n```",
    order: "a1",
    heading_level: 2,
    parent_id: "01KEVAL04CH00000000000002",
    children: [],
  },
  {
    local_id: "01KEVAL04SE00000000000003",
    type: "section",
    name: "3.3 hotfix 分支与紧急修复",
    content:
      "hotfix 分支用于修复生产环境的紧急问题，从 master（或 main）直接创建。修复完成后合并回 master 并打新版本 tag，同时合并回 develop 以防止问题再次出现。在 Trunk-Based Development 中，hotfix 通常直接提交到 trunk 并通过 Feature Flag 控制回滚，不需要独立分支。详见 [[01KEVAL04CH00000000000003]] 了解 Trunk-Based 的渐进式发布策略。\n\n```\n# GitFlow hotfix 流程\ngit checkout -b hotfix/1.2.1 master\n# 修复紧急 bug\ngit checkout master && git merge --no-ff hotfix/1.2.1\ngit tag -a v1.2.1\ngit checkout develop && git merge --no-ff hotfix/1.2.1\n```",
    order: "a2",
    heading_level: 2,
    parent_id: "01KEVAL04CH00000000000003",
    children: [],
  },
];

// ============================================================
// Seed data definitions
// ============================================================
const SEEDS = [
  {
    name: "Entity 1: JavaScript 异步编程完全指南",
    abstract:
      "JavaScript 异步编程完全指南，涵盖 Promise、async/await、并发控制和高级模式",
    overview:
      "本指南系统讲解 JavaScript 异步编程，从 Promise 基础到 async/await 语法，再到并发控制和高级模式（异步迭代器、取消机制）。每个主题配有代码示例和跨章节引用。",
    content:
      "JavaScript 异步编程完全指南。涵盖 Promise 状态机、then/catch/finally 链、Promise 组合方法、async/await 语法、错误处理、并发控制、异步迭代器以及 AbortController 取消机制。",
    type: "memory",
    tags: ["javascript", "async", "promise", "async-await", "concurrency"],
    atoms: ENTITY1_ATOMS,
  },
  {
    name: "Entity 2: Vue 3 Composition API 指南",
    abstract: "Vue 3 Composition API 完全指南",
    overview:
      "涵盖 setup 函数、ref/reactive 响应式、computed/watch 计算属性、以及生命周期钩子",
    content:
      "Vue 3 Composition API 完全指南。涵盖 setup 函数与返回值、ref 与 reactive 响应式系统、ref 解包规则、computed 与 watch/watchEffect 依赖收集、以及 onMounted 等生命周期钩子的使用。",
    type: "memory",
    tags: ["vue", "vue3", "composition-api", "reactivity", "frontend"],
    atoms: ENTITY2_ATOMS,
  },
  {
    name: "Entity 3: Node.js 流式处理架构指南",
    abstract: "Node.js 流式处理架构指南",
    overview:
      "涵盖 Readable/Writable/Transform 三种流、pipe 方法、背压机制和错误处理",
    content:
      "Node.js 流式处理架构指南。涵盖 Readable 流（流动/暂停模式）、Writable 流（缓冲区与背压）、Transform 流（数据转换）、pipe 方法与管道连接、背压处理机制、以及基于 pipeline 的错误处理策略。",
    type: "memory",
    tags: ["nodejs", "stream", "pipe", "backpressure", "backend"],
    atoms: ENTITY3_ATOMS,
  },
  {
    name: "Entity 4: Git 分支管理策略对比指南",
    abstract: "Git 分支管理策略对比指南",
    overview:
      "涵盖 GitFlow、GitHub Flow、Trunk-Based Development 三种主流分支策略",
    content:
      "Git 分支管理策略对比指南。涵盖 GitFlow（五分支模型、feature/release/hotfix 规范）、GitHub Flow（简化双分支、PR 驱动开发）、Trunk-Based Development（主干开发、Feature Flag、渐进式发布）三种主流策略的原理、适用场景和最佳实践。",
    type: "memory",
    tags: ["git", "branching", "gitflow", "github-flow", "trunk-based"],
    atoms: ENTITY4_ATOMS,
  },
];

async function main() {
  console.log("Creating seed data for v3.3 evaluation...\n");

  const results = [];

  for (const seed of SEEDS) {
    console.log(`Creating: ${seed.name}...`);

    // Use direct API call to POST /api/v1/entities to ensure entity_id is populated
    try {
      // Debug: Log the first atom's local_id before sending
      if (seed.atoms && seed.atoms.length > 0) {
        console.log(`  First atom local_id: ${seed.atoms[0].local_id}`);
        console.log(
          `  First atom local_id length: ${seed.atoms[0].local_id?.length}`,
        );
        console.log(`  Total atoms: ${seed.atoms.length}`);
        // Log all atom local_ids
        console.log(
          `  All atom local_ids: ${seed.atoms.map((a) => a.local_id).join(", ")}`,
        );
      }

      const requestBody = {
        type: seed.type,
        abstract: seed.abstract,
        overview: {
          description: seed.overview,
          atoms_count: seed.atoms ? seed.atoms.length : 0,
        },
        content: seed.content,
        atoms: seed.atoms,
        tags: seed.tags,
        tenant_id: "default",
      };
      console.log(
        `  Request body atoms: ${JSON.stringify(
          requestBody.atoms.map((a) => ({
            local_id: a.local_id,
            name: a.name,
          })),
          null,
          2,
        )}`,
      );

      const response = await client.http.post("/api/v1/entities", requestBody);

      const result = response;

      console.log(`  API Response: ${JSON.stringify(result, null, 2)}`);

      if (!result || !result.id) {
        console.error(
          `  FAILED: Invalid response from API - missing 'id' field`,
        );
        console.error(`  Response keys: ${Object.keys(result || {})}`);
        process.exit(1);
      }

      console.log(`  Entity ID: ${result.id}`);
      console.log(`  Atoms: ${seed.atoms ? seed.atoms.length : 0}`);
      results.push({ ...seed, entityId: result.id });
    } catch (error) {
      console.error(`  FAILED: ${error.message}`);
      if (error.response) {
        console.error(`  Response: ${JSON.stringify(error.response.data)}`);
      }
      process.exit(1);
    }
  }

  console.log(`\nAll ${results.length} seed entities created successfully!`);
  console.log("\n--- Summary ---");
  for (const r of results) {
    console.log(`  ${r.name}`);
    console.log(`    Entity ID: ${r.entityId}`);
  }

  console.log("\n--- Next Steps ---");
  console.log("1. Update queries.json with the Entity IDs above");
  console.log("2. Replace PLACEHOLDER values in queries.json");
  console.log("3. Run evaluation scripts:");
  console.log("   node evaluate-atom-quality.js <entityId>");
  console.log("   node evaluate-search-performance.js queries.json");
}

main().catch(console.error);
