/**
 * 历史消息 Redis 缓存
 * 减少数据库查询，提升 AI 聊天响应速度
 */
import redis from './redis';
import Message from '../models/Message';
import mongoose from 'mongoose';

const HISTORY_CACHE_KEY = (conversationId: string) => `history:${conversationId}`;
const HISTORY_CACHE_TTL = 300; // 5 分钟

/**
 * 获取最近消息（带 Redis 缓存）
 * 优先从 Redis 读取，缓存未命中时查询数据库
 */
export async function getRecentMessages(
    conversationId: string | mongoose.Types.ObjectId,
    limit: number = 10
) {
    const convId = conversationId.toString();
    const cacheKey = HISTORY_CACHE_KEY(convId);

    try {
        // 尝试从 Redis 缓存读取
        const cached = await redis.lrange(cacheKey, 0, limit - 1);

        if (cached.length >= limit) {
            return cached.map(msg => JSON.parse(msg));
        }
    } catch (err) {
        // Redis 读取失败，降级到数据库查询
        console.warn('Redis cache read failed, falling back to DB:', err instanceof Error ? err.message : err);
    }

    // 缓存未命中，查询数据库
    const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    const reversedMessages = messages.reverse();

    // 异步写入缓存（不阻塞响应）
    if (reversedMessages.length > 0) {
        setImmediate(async () => {
            try {
                await redis.del(cacheKey);
                await redis.rpush(cacheKey, ...reversedMessages.map(m => JSON.stringify(m)));
                await redis.expire(cacheKey, HISTORY_CACHE_TTL);
            } catch (err) {
                console.warn('Redis cache write failed:', err instanceof Error ? err.message : err);
            }
        });
    }

    return reversedMessages;
}

/**
 * 使消息缓存失效
 * 在新消息保存后调用
 */
export async function invalidateMessageCache(conversationId: string | mongoose.Types.ObjectId) {
    const convId = conversationId.toString();
    const cacheKey = HISTORY_CACHE_KEY(convId);

    try {
        await redis.del(cacheKey);
    } catch (err) {
        // 缓存失效失败不影响主流程
        console.warn('Redis cache invalidation failed:', err instanceof Error ? err.message : err);
    }
}

/**
 * 追加新消息到缓存
 * 在保存新消息后调用，避免完全失效缓存
 */
export async function appendMessageToCache(
    conversationId: string | mongoose.Types.ObjectId,
    message: Record<string, unknown>
) {
    const convId = conversationId.toString();
    const cacheKey = HISTORY_CACHE_KEY(convId);

    try {
        // 检查缓存是否存在
        const exists = await redis.exists(cacheKey);
        if (exists) {
            // 追加到列表末尾
            await redis.rpush(cacheKey, JSON.stringify(message));
            // 保持列表长度不超过 20
            await redis.ltrim(cacheKey, -20, -1);
            // 刷新 TTL
            await redis.expire(cacheKey, HISTORY_CACHE_TTL);
        }
    } catch (err) {
        // 缓存操作失败不影响主流程
        console.warn('Redis cache append failed:', err instanceof Error ? err.message : err);
    }
}
