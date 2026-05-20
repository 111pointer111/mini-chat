/**
 * 请求监控中间件
 *
 * 工作原理：
 *   1. 在请求进入时记录 startTime
 *   2. 监听 response 的 'finish' 事件（响应已发送给客户端）
 *   3. 计算延迟 = Date.now() - startTime
 *   4. 将 statusCode 和 latency 写入 MetricsCollector
 *
 * 为什么监听 'finish' 而不是 'end'？
 *   - 'end' 是 response 流结束，可能在 finish 之前触发
 *   - 'finish' 是数据已写入内核缓冲区，表示响应真正发出
 */

import { Request, Response, NextFunction } from 'express';
import { metrics } from './metrics';

/**
 * Express 中间件：自动记录每个请求的状态码和响应时间
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // 监听响应完成事件
    res.on('finish', () => {
        const latencyMs = Date.now() - startTime;
        metrics.recordRequest(res.statusCode, latencyMs);
    });

    next();
}

/**
 * 错误处理中间件 — 放在所有路由之后
 *
 * Express 错误中间件必须有 4 个参数 (err, req, res, next)
 * 捕获未处理的路由错误，返回 500 响应
 * 请求指标由 metricsMiddleware 的 finish 事件自动记录
 */
export function errorHandlerMiddleware(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // 确保响应状态码是 5xx
    if (!res.headersSent) {
        res.status(500).json({
            message: 'Internal server error',
            // 生产环境不暴露错误详情
            ...(process.env.NODE_ENV !== 'production' && { error: err.message }),
        });
    }

    // 记录错误到指标（如果 metricsMiddleware 还没记录的话）
    // 注意：finish 事件仍会触发，所以这里不需要重复记录
    // 但我们可以记录额外的错误信息用于告警
    console.error(`[Error] ${req.method} ${req.path}: ${err.message}`);
}
