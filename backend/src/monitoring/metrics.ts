/**
 * 指标收集器 — 在内存中收集应用运行指标
 *
 * 设计思路：
 *   使用滑动窗口（默认 5 分钟）记录指标数据点
 *   请求/错误只存时间戳（number[]），延迟/内存存 DataPoint（需要 value）
 *   定期清理过期数据点，避免内存泄漏
 */

interface DataPoint {
    timestamp: number;
    value: number;
}

export class MetricsCollector {
    // 请求时间戳（只存时间戳，用于窗口内计数）
    private requestTimestamps: number[] = [];
    // 按状态码分组的请求时间戳
    private statusTimestamps: Map<string, number[]> = new Map();

    // 响应时间（需要存 value）
    private latencies: DataPoint[] = [];

    // 错误时间戳（只存时间戳）
    private errors: number[] = [];
    private clientErrors: number[] = [];

    // 系统指标采样（需要存 value）
    private memorySamples: DataPoint[] = [];
    private socketConnections: DataPoint[] = [];

    // 全量计数（用于展示累计值）
    private totalRequests = 0;

    // 时间窗口：保留最近 5 分钟的数据
    private readonly windowMs = 5 * 60 * 1000;

    // 定时器句柄
    private cleanupTimer: ReturnType<typeof setInterval>;
    private sampleTimer: ReturnType<typeof setInterval>;

    constructor() {
        this.cleanupTimer = setInterval(() => this.cleanup(), 30_000);
        this.sampleTimer = setInterval(() => this.sampleSystemMetrics(), 15_000);
    }

    // ==================== 数据录入 ====================

    recordRequest(statusCode: number, latencyMs: number): void {
        const now = Date.now();

        this.totalRequests++;
        this.requestTimestamps.push(now);

        // 按状态码分组
        const key = String(statusCode);
        let arr = this.statusTimestamps.get(key);
        if (!arr) {
            arr = [];
            this.statusTimestamps.set(key, arr);
        }
        arr.push(now);

        // 响应时间
        this.latencies.push({ timestamp: now, value: latencyMs });

        // 错误分类
        if (statusCode >= 500) {
            this.errors.push(now);
        } else if (statusCode >= 400) {
            this.clientErrors.push(now);
        }
    }

    recordSocketConnections(count: number): void {
        this.socketConnections.push({ timestamp: Date.now(), value: count });
    }

    // ==================== 指标查询 ====================

    getSnapshot(): MetricsSnapshot {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // 窗口内数据
        const recentRequests = this.requestTimestamps.filter(t => t >= windowStart);
        const recentLatencies = this.latencies.filter(dp => dp.timestamp >= windowStart).map(dp => dp.value);
        const recentErrors = this.errors.filter(t => t >= windowStart);
        const recentClientErrors = this.clientErrors.filter(t => t >= windowStart);

        // 窗口内按状态码计数
        const byStatus: Record<string, number> = {};
        for (const [key, timestamps] of this.statusTimestamps) {
            byStatus[key] = timestamps.filter(t => t >= windowStart).length;
        }

        const latencyStats = this.calculateLatencyStats(recentLatencies);

        // 错误率 = 窗口内错误数 / 窗口内请求数
        const errorRate = recentRequests.length > 0
            ? (recentErrors.length / recentRequests.length) * 100
            : 0;

        const latestMemory = this.getLatestValue(this.memorySamples);
        const latestSockets = this.getLatestValue(this.socketConnections);

        return {
            timestamp: new Date(now).toISOString(),
            requests: {
                total: this.totalRequests,
                windowed: recentRequests.length,
                byStatus,
            },
            latency: latencyStats,
            errors: {
                server5xx: recentErrors.length,
                client4xx: recentClientErrors.length,
                ratePercent: Math.round(errorRate * 100) / 100,
            },
            system: {
                memoryUsageMB: latestMemory
                    ? Math.round(latestMemory / 1024 / 1024)
                    : Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                socketConnections: latestSockets ?? 0,
                uptimeSeconds: Math.floor(process.uptime()),
            },
        };
    }

    private calculateLatencyStats(latencies: number[]): LatencyStats {
        if (latencies.length === 0) {
            return { p50: 0, p95: 0, p99: 0, max: 0, count: 0 };
        }

        const sorted = [...latencies].sort((a, b) => a - b);
        const len = sorted.length;

        return {
            p50: sorted[Math.floor(len * 0.5)],
            p95: sorted[Math.floor(len * 0.95)],
            p99: sorted[Math.floor(len * 0.99)],
            max: sorted[len - 1],
            count: len,
        };
    }

    private getLatestValue(samples: DataPoint[]): number | null {
        if (samples.length === 0) return null;
        return samples[samples.length - 1].value;
    }

    // ==================== 系统采样 ====================

    private sampleSystemMetrics(): void {
        this.memorySamples.push({
            timestamp: Date.now(),
            value: process.memoryUsage().heapUsed,
        });
    }

    // ==================== 清理 ====================

    private cleanup(): void {
        const cutoff = Date.now() - this.windowMs;

        this.requestTimestamps = this.requestTimestamps.filter(t => t >= cutoff);
        this.latencies = this.latencies.filter(dp => dp.timestamp >= cutoff);
        this.errors = this.errors.filter(t => t >= cutoff);
        this.clientErrors = this.clientErrors.filter(t => t >= cutoff);
        this.memorySamples = this.memorySamples.filter(dp => dp.timestamp >= cutoff);
        this.socketConnections = this.socketConnections.filter(dp => dp.timestamp >= cutoff);

        // 清理按状态码分组的时间戳
        for (const [key, timestamps] of this.statusTimestamps) {
            const filtered = timestamps.filter(t => t >= cutoff);
            if (filtered.length === 0) {
                this.statusTimestamps.delete(key);
            } else {
                this.statusTimestamps.set(key, filtered);
            }
        }
    }

    destroy(): void {
        clearInterval(this.cleanupTimer);
        clearInterval(this.sampleTimer);
    }
}

// ==================== 类型定义 ====================

interface LatencyStats {
    p50: number;
    p95: number;
    p99: number;
    max: number;
    count: number;
}

export interface MetricsSnapshot {
    timestamp: string;
    requests: {
        total: number;
        windowed: number;
        byStatus: Record<string, number>;
    };
    latency: LatencyStats;
    errors: {
        server5xx: number;
        client4xx: number;
        ratePercent: number;
    };
    system: {
        memoryUsageMB: number;
        socketConnections: number;
        uptimeSeconds: number;
    };
}

export const metrics = new MetricsCollector();
