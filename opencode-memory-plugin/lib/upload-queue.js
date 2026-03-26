/**
 * Upload Queue - 管理上传失败的任务
 *
 * 功能：
 * - 持久化失败的上传任务
 * - 重试机制
 * - 批量重试
 */

import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const QUEUE_FILE = path.join(MEMORY_DIR, 'upload-queue.json');
const MAX_RETRY = 3;

/**
 * 读取队列
 */
function readQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // ignore
  }
  return { failed_uploads: [] };
}

/**
 * 写入队列
 */
function writeQueue(queue) {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

/**
 * 添加上传任务到队列
 */
export function addToQueue(memory) {
  const queue = readQueue();

  queue.failed_uploads.push({
    timestamp: new Date().toISOString(),
    memory,
    retry_count: 0,
    last_error: null,
  });

  writeQueue(queue);
}

/**
 * 标记任务为成功 (从队列移除)
 */
export function removeFromQueue(index) {
  const queue = readQueue();

  if (index >= 0 && index < queue.failed_uploads.length) {
    queue.failed_uploads.splice(index, 1);
    writeQueue(queue);
    return true;
  }

  return false;
}

/**
 * 更新重试次数
 */
export function incrementRetry(index, error) {
  const queue = readQueue();

  if (index >= 0 && index < queue.failed_uploads.length) {
    queue.failed_uploads[index].retry_count++;
    queue.failed_uploads[index].last_error = error?.message || error;
    writeQueue(queue);
    return true;
  }

  return false;
}

/**
 * 获取所有待重试的任务
 */
export function getPendingUploads() {
  const queue = readQueue();

  // 过滤掉超过最大重试次数的任务
  return queue.failed_uploads
    .map((item, index) => ({ ...item, index }))
    .filter(item => item.retry_count < MAX_RETRY);
}

/**
 * 获取队列统计
 */
export function getQueueStats() {
  const queue = readQueue();

  const pending = queue.failed_uploads.filter(item => item.retry_count < MAX_RETRY).length;
  const exhausted = queue.failed_uploads.filter(item => item.retry_count >= MAX_RETRY).length;

  return {
    total: queue.failed_uploads.length,
    pending,
    exhausted,
    max_retry: MAX_RETRY,
  };
}

/**
 * 清空队列
 */
export function clearQueue() {
  writeQueue({ failed_uploads: [] });
}

/**
 * 清理超过最大重试次数的任务
 */
export function cleanExhausted() {
  const queue = readQueue();
  queue.failed_uploads = queue.failed_uploads.filter(item => item.retry_count < MAX_RETRY);
  writeQueue(queue);
}

export default {
  addToQueue,
  removeFromQueue,
  incrementRetry,
  getPendingUploads,
  getQueueStats,
  clearQueue,
  cleanExhausted,
};
