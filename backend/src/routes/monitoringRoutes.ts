import express from 'express';
import mongoose from 'mongoose';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { protect, adminOnly } from '../middleware/authMiddleware';
import { MonitoringHandle } from '../monitoring';

interface MonitoringDeps {
    redis: Redis;
    pgPool: Pool;
    monitoring: MonitoringHandle;
}

/**
 * 创建监控路由
 *
 * 使用工厂函数注入依赖，避免模块级单例耦合
 * 端点路径与 server.ts 中 app.use() 的挂载方式一致：
 *   app.use('/api', createMonitoringRoutes(deps))  → /api/ready, /api/metrics, /api/alerts
 */
export function createMonitoringRoutes(deps: MonitoringDeps) {
    const router = express.Router();

    // /ready — 不需要 auth（给 Docker/K8s 健康检查用）
    router.get('/ready', async (_req, res) => {
        const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
        let allHealthy = true;

        // MongoDB
        try {
            const start = Date.now();
            if (!mongoose.connection.db) throw new Error('MongoDB not connected');
            await mongoose.connection.db.admin().ping();
            checks.mongodb = { status: 'up', latencyMs: Date.now() - start };
            deps.monitoring.metrics.recordDependency('mongodb', 'up', checks.mongodb.latencyMs);
        } catch (err: any) {
            checks.mongodb = { status: 'down', error: err.message };
            deps.monitoring.metrics.recordDependency('mongodb', 'down', undefined, err.message);
            allHealthy = false;
        }

        // Redis
        try {
            const start = Date.now();
            await deps.redis.ping();
            checks.redis = { status: 'up', latencyMs: Date.now() - start };
            deps.monitoring.metrics.recordDependency('redis', 'up', checks.redis.latencyMs);
        } catch (err: any) {
            checks.redis = { status: 'down', error: err.message };
            deps.monitoring.metrics.recordDependency('redis', 'down', undefined, err.message);
            allHealthy = false;
        }

        // PostgreSQL
        try {
            const start = Date.now();
            await Promise.race([
                deps.pgPool.query('SELECT 1'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('PG query timeout')), 5000)),
            ]);
            checks.postgres = { status: 'up', latencyMs: Date.now() - start };
            deps.monitoring.metrics.recordDependency('postgres', 'up', checks.postgres.latencyMs);
        } catch (err: any) {
            checks.postgres = { status: 'down', error: err.message };
            deps.monitoring.metrics.recordDependency('postgres', 'down', undefined, err.message);
            allHealthy = false;
        }

        const statusCode = allHealthy ? 200 : 503;
        res.status(statusCode).json({
            status: allHealthy ? 'ready' : 'not_ready',
            timestamp: new Date().toISOString(),
            checks,
        });
    });

    // /metrics — admin only
    router.get('/metrics', protect, adminOnly, (_req, res) => {
        res.json(deps.monitoring.getSnapshot());
    });

    // /alerts — admin only
    router.get('/alerts', protect, adminOnly, (_req, res) => {
        res.json(deps.monitoring.alertManager.getStatus(deps.monitoring.getSnapshot()));
    });

    return router;
}
