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

export interface DependencyStatus {
    status: 'up' | 'down' | 'unknown';
    latencyMs?: number;
    error?: string;
    checkedAt?: string;
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
    private eventLoopLagSamples: DataPoint[] = [];
    private dependencies: Record<string, DependencyStatus> = {};

    // 全量计数（用于展示累计值）
    private totalRequests = 0;

    // 时间窗口：保留最近 5 分钟的数据
    private readonly windowMs = 5 * 60 * 1000;

    // 定时器句柄
    private cleanupTimer: ReturnType<typeof setInterval>;
    private sampleTimer: ReturnType<typeof setInterval>;
    private lastSampleAt = Date.now();

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

    recordDependency(
        name: string,
        status: 'up' | 'down',
        latencyMs?: number,
        error?: string
    ): void {
        this.dependencies[name] = {
            status,
            latencyMs,
            error,
            checkedAt: new Date().toISOString(),
        };
    }

    // ==================== 指标查询 ====================

    getSnapshot(): MetricsSnapshot {
        const now = Date.now();
        const oneMinute = this.buildWindow(now, 60_000);
        const fiveMinutes = this.buildWindow(now, this.windowMs);

        const latestMemory = this.getLatestValue(this.memorySamples);
        const latestSockets = this.getLatestValue(this.socketConnections);
        const latestEventLoopLag = this.getLatestValue(this.eventLoopLagSamples) ?? 0;

        return {
            timestamp: new Date(now).toISOString(),
            requests: {
                total: this.totalRequests,
                windowed: fiveMinutes.requests,
                byStatus: fiveMinutes.byStatus,
            },
            latency: fiveMinutes.latency,
            errors: {
                server5xx: fiveMinutes.server5xx,
                client4xx: fiveMinutes.client4xx,
                ratePercent: fiveMinutes.errorRatePercent,
            },
            windows: {
                oneMinute,
                fiveMinutes,
            },
            system: {
                memoryUsageMB: latestMemory
                    ? Math.round(latestMemory / 1024 / 1024)
                    : Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                socketConnections: latestSockets ?? 0,
                uptimeSeconds: Math.floor(process.uptime()),
                eventLoopLagMs: Math.max(0, Math.round(latestEventLoopLag)),
                dependencies: this.dependencies,
            },
        };
    }

    private buildWindow(now: number, windowMs: number): WindowMetrics {
        const windowStart = now - windowMs;

        const recentRequests = this.requestTimestamps.filter(t => t >= windowStart);
        const recentLatencies = this.latencies
            .filter(dp => dp.timestamp >= windowStart)
            .map(dp => dp.value);
        const recentErrors = this.errors.filter(t => t >= windowStart);
        const recentClientErrors = this.clientErrors.filter(t => t >= windowStart);

        const byStatus: Record<string, number> = {};
        for (const [key, timestamps] of this.statusTimestamps) {
            byStatus[key] = timestamps.filter(t => t >= windowStart).length;
        }

        const errorRate = recentRequests.length > 0
            ? (recentErrors.length / recentRequests.length) * 100
            : 0;
        const durationSeconds = windowMs / 1000;

        return {
            durationSeconds,
            requests: recentRequests.length,
            rps: Math.round((recentRequests.length / durationSeconds) * 100) / 100,
            byStatus,
            latency: this.calculateLatencyStats(recentLatencies),
            server5xx: recentErrors.length,
            client4xx: recentClientErrors.length,
            errorRatePercent: Math.round(errorRate * 100) / 100,
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
        const now = Date.now();
        const expectedInterval = 15_000;
        const eventLoopLagMs = Math.max(0, now - this.lastSampleAt - expectedInterval);
        this.lastSampleAt = now;

        this.memorySamples.push({
            timestamp: now,
            value: process.memoryUsage().heapUsed,
        });
        this.eventLoopLagSamples.push({
            timestamp: now,
            value: eventLoopLagMs,
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
        this.eventLoopLagSamples = this.eventLoopLagSamples.filter(dp => dp.timestamp >= cutoff);

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

interface WindowMetrics {
    durationSeconds: number;
    requests: number;
    rps: number;
    byStatus: Record<string, number>;
    latency: LatencyStats;
    server5xx: number;
    client4xx: number;
    errorRatePercent: number;
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
    windows: {
        oneMinute: WindowMetrics;
        fiveMinutes: WindowMetrics;
    };
    system: {
        memoryUsageMB: number;
        socketConnections: number;
        uptimeSeconds: number;
        eventLoopLagMs: number;
        dependencies: Record<string, DependencyStatus>;
    };
}

export const metrics = new MetricsCollector();
