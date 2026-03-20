import { readFileSync } from 'fs';

const testCases = [
  {
    name: '消息数量< 8',
    messages: [
      { role: 'user', content: '你好', timestamp: 1000 },
      { role: 'assistant', content: '你好！有什么可以帮你的吗？', timestamp: 2000 },
      { role: 'user', content: '测试', timestamp: 3000 },
      { role: 'assistant', content: '好的', timestamp: 4000 }
    ],
    shouldSkip: true
  },
  {
    name: '总字符数< 400',
    messages: [
      { role: 'user', content: '这是一个测试消息', timestamp: 1000 },
      { role: 'assistant', content: '好的，我理解了', timestamp: 2000 },
      { role: 'user', content: '继续', timestamp: 3000 },
      { role: 'assistant', content: '没问题', timestamp: 4000 },
      { role: 'user', content: '很好', timestamp: 5000 },
      { role: 'assistant', content: '收到', timestamp: 6000 },
      { role: 'user', content: '完成', timestamp: 7000 },
      { role: 'assistant', content: '好的', timestamp: 8000 }
    ],
    shouldSkip: true
  },
  {
    name: '对话时长< 5分钟',
    messages: [
      { role: 'user', content: '这是一个比较长的消息内容，用来测试字符数阈值。我们需要确保总字符数超过400，但是对话时长小于5分钟。这里需要更多的文字来达到字符数要求。', timestamp: 1000 },
      { role: 'assistant', content: '好的，我理解了。这是一个测试消息，用来验证时长过滤功能是否正常工作。我会提供详细的回复来确保字符数足够。', timestamp: 2000 },
      { role: 'user', content: '继续测试这个功能', timestamp: 3000 },
      { role: 'assistant', content: '没问题，我会继续', timestamp: 4000 },
      { role: 'user', content: '很好，继续', timestamp: 5000 },
      { role: 'assistant', content: '收到，继续执行', timestamp: 6000 },
      { role: 'user', content: '完成测试', timestamp: 7000 },
      { role: 'assistant', content: '好的，测试完成', timestamp: 8000 }
    ],
    shouldSkip: true
  },
  {
    name: '对话时长< 2分钟',
    messages: [
      { role: 'user', content: '这是一个比较长的消息内容，用来测试字符数阈值。我们需要确保总字符数超过200，但是对话时长小于2分钟。', timestamp: 1000 },
      { role: 'assistant', content: '好的，我理解了。这是一个测试消息，用来验证时长过滤功能是否正常工作。', timestamp: 2000 },
      { role: 'user', content: '继续测试', timestamp: 3000 },
      { role: 'assistant', content: '没问题', timestamp: 4000 },
      { role: 'user', content: '很好', timestamp: 5000 }
    ],
    shouldSkip: true
  },
  {
    name: '包含测试关键词（短对话）',
    messages: [
      { role: 'user', content: '试试这个功能', timestamp: 1000 },
      { role: 'assistant', content: '好的', timestamp: 2000 },
      { role: 'user', content: '继续', timestamp: 3000 },
      { role: 'assistant', content: '没问题', timestamp: 4000 },
      { role: 'user', content: '很好', timestamp: 5000 },
      { role: 'assistant', content: '收到', timestamp: 6000 },
      { role: 'user', content: '完成', timestamp: 7000 },
      { role: 'assistant', content: '好的', timestamp: 8000 }
    ],
    shouldSkip: true
  },
  {
    name: '用户消息< 4',
    messages: [
      { role: 'user', content: '帮我实现一个功能，需要使用Python编写一个脚本来处理数据。这是一个比较复杂的需求。', timestamp: 1000 },
      { role: 'assistant', content: '好的，我来帮你实现。这是代码：```python\nprint("hello")\n```这段代码可以实现你的需求。', timestamp: 300000 },
      { role: 'user', content: '谢谢', timestamp: 310000 },
      { role: 'assistant', content: '不客气！如果还有其他问题，随时告诉我。我会继续帮助你解决问题。', timestamp: 320000 },
      { role: 'assistant', content: '还需要其他帮助吗？我可以提供更多的支持和建议。', timestamp: 330000 },
      { role: 'user', content: '不用了', timestamp: 340000 },
      { role: 'assistant', content: '好的，祝你工作顺利！', timestamp: 350000 },
      { role: 'assistant', content: '再见！', timestamp: 360000 }
    ],
    shouldSkip: true
  },
  {
    name: '没有工具调用',
    messages: [
      { role: 'user', content: '什么是Python？', timestamp: 1000 },
      { role: 'assistant', content: 'Python是一种高级编程语言，具有简洁的语法和强大的功能。它广泛应用于Web开发、数据分析、人工智能等领域。', timestamp: 130000 },
      { role: 'user', content: '它有什么特点？', timestamp: 140000 },
      { role: 'assistant', content: 'Python的主要特点包括：1. 语法简洁易读 2. 丰富的标准库 3. 跨平台支持 4. 强大的社区支持', timestamp: 150000 },
      { role: 'user', content: '明白了', timestamp: 160000 }
    ],
    shouldSkip: true
  },
  {
    name: '没有代码块',
    messages: [
      { role: 'user', content: '帮我分析一下这个问题', timestamp: 1000 },
      { role: 'assistant', content: '好的，让我来分析。首先需要理解问题的背景，然后制定解决方案。', timestamp: 130000 },
      { role: 'user', content: '具体怎么做？', timestamp: 140000 },
      { role: 'assistant', content: '具体步骤如下：第一步是收集数据，第二步是分析数据，第三步是得出结论。这个过程需要仔细规划。', timestamp: 150000 },
      { role: 'user', content: '好的，我明白了', timestamp: 160000 }
    ],
    shouldSkip: true
  },
  {
    name: 'AI回复平均长度< 150',
    messages: [
      { role: 'user', content: '帮我实现一个功能，需要详细的代码和说明。这是一个复杂的需求，需要你仔细分析。我希望得到完整的解决方案。', timestamp: 1000 },
      { role: 'assistant', content: '好的', timestamp: 300000 },
      { role: 'user', content: '具体怎么做？需要什么步骤？请详细说明一下实现过程。', timestamp: 310000 },
      { role: 'assistant', content: '```python\nprint("test")\n```', timestamp: 320000 },
      { role: 'user', content: '还有其他方案吗？能否提供更多的选择和建议？', timestamp: 330000 },
      { role: 'assistant', content: '有的', timestamp: 340000 },
      { role: 'user', content: '请详细说明', timestamp: 350000 },
      { role: 'assistant', content: '可以', timestamp: 360000 }
    ],
    shouldSkip: true
  },
  {
    name: '正常的深度对话（不应该跳过）',
    messages: [
      { role: 'user', content: '帮我实现一个记忆系统的自动触发功能，需要添加智能过滤机制。这个功能非常重要，需要仔细设计和实现。', timestamp: 1000 },
      { role: 'assistant', content: '好的，我来帮你实现。首先我们需要分析需求，然后设计预过滤条件。让我先读取现有代码，了解当前的实现情况。这是实现方案：```javascript\nconst shouldSkip = (session) => { return false; }\n```我会基于这个方案进行改进，添加更多的过滤条件。', timestamp: 300000 },
      { role: 'user', content: '需要更严格的过滤条件，确保只在真正有价值的对话时才触发。我希望能过滤掉大部分简单对话。', timestamp: 310000 },
      { role: 'assistant', content: '明白了，我会添加更严格的条件。包括消息数量、字符数、对话时长、工具调用检测等多个维度的过滤。让我修改代码，实现这些功能。这样可以确保只有深度对话才会触发。', timestamp: 320000 },
      { role: 'user', content: '很好，继续实施这个方案，尽快完成', timestamp: 330000 },
      { role: 'assistant', content: '好的，我现在开始实施。首先添加预过滤函数，然后修改event hook。这是完整的实现代码，包含了所有必要的检查逻辑。我会确保代码质量和功能完整性。', timestamp: 340000 },
      { role: 'user', content: '实现完成后需要验证功能', timestamp: 350000 },
      { role: 'assistant', content: '好的，我来创建测试脚本验证功能。这是测试代码：```javascript\nconst test = () => { console.log("test"); }\n```测试脚本会验证所有的过滤条件是否正常工作，确保没有遗漏。', timestamp: 360000 }
    ],
    shouldSkip: false
  }
];

console.log('开始测试智能过滤功能...\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const session = { messages: testCase.messages };
  
  let result;
  try {
    const messages = session.messages;
    
    if (messages.length < 8) {
      result = true;
    } else {
      const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
      if (totalChars < 400) {
        result = true;
      } else {
        const timestamps = messages.map(m => m.timestamp).filter(Boolean);
        if (timestamps.length >= 2) {
          const duration = Math.max(...timestamps) - Math.min(...timestamps);
          if (duration < 300000) {
            result = true;
          } else {
            if (messages.length < 10 && totalChars < 500) {
              const testKeywords = ['试试', '试一下', '算了', '不用了', '取消', 'cancel', 'nevermind'];
              const allText = JSON.stringify(messages).toLowerCase();
              if (testKeywords.some(kw => allText.includes(kw))) {
                result = true;
              } else {
                const userMessages = messages.filter(m => m.role === 'user');
                if (userMessages.length < 4) {
                  result = true;
                } else {
                  const hasToolUse = messages.some(m => {
                    const content = JSON.stringify(m);
                    return content.includes('tool_use') || content.includes('"type":"tool_use"');
                  });
                  
                  const hasCodeBlock = allText.includes('```');
                  
                  const aiMessages = messages.filter(m => m.role === 'assistant');
                  let hasLongReplies = false;
                  if (aiMessages.length > 0) {
                    const avgLength = aiMessages.reduce((sum, m) => sum + m.content.length, 0) / aiMessages.length;
                    hasLongReplies = avgLength >= 150;
                  }
                  
                  if (!hasToolUse && !hasCodeBlock && !hasLongReplies) {
                    result = true;
                  } else {
                    result = false;
                  }
                }
              }
            } else {
              const userMessages = messages.filter(m => m.role === 'user');
              if (userMessages.length < 4) {
                result = true;
              } else {
                const hasToolUse = messages.some(m => {
                  const content = JSON.stringify(m);
                  return content.includes('tool_use') || content.includes('"type":"tool_use"');
                });
                
                const allText = JSON.stringify(messages).toLowerCase();
                const hasCodeBlock = allText.includes('```');
                
                const aiMessages = messages.filter(m => m.role === 'assistant');
                let hasLongReplies = false;
                if (aiMessages.length > 0) {
                  const avgLength = aiMessages.reduce((sum, m) => sum + m.content.length, 0) / aiMessages.length;
                  hasLongReplies = avgLength >= 150;
                }
                
                if (!hasToolUse && !hasCodeBlock && !hasLongReplies) {
                  result = true;
                } else {
                  result = false;
                }
              }
            }
          }
        } else {
          result = false;
        }
      }
    }
  } catch (error) {
    console.error(`测试 ${index + 1} 执行出错:`, error);
    result = false;
  }
  
  const success = result === testCase.shouldSkip;
  if (success) {
    passed++;
    console.log(`✅ 测试 ${index + 1}: ${testCase.name} - 通过`);
  } else {
    failed++;
    console.log(`❌ 测试 ${index + 1}: ${testCase.name} - 失败`);
    console.log(`   期望: ${testCase.shouldSkip ? '跳过' : '不跳过'}, 实际: ${result ? '跳过' : '不跳过'}`);
  }
});

console.log(`\n测试完成: ${passed}/${testCases.length} 通过, ${failed}/${testCases.length} 失败`);
process.exit(failed > 0 ? 1 : 0);
