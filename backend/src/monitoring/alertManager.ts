/**
 * 告警管理器
 *
 * 核心职责：
 *   1. 定义告警规则（什么条件触发告警）
 *   2. 管理告警状态机（normal → pending → firing → resolved）
 *   3. 冷却期去重（同一告警在冷却期内不重复发送）
 *
 * 注意：评估调度由外部（setupMonitoring）驱动，本类是纯状态机
 *
 * 告警状态机详解：
 *
 *   ┌────────┐  条件满足   ┌─────────┐  持续 N 秒  ┌────────┐
 *   │ normal │ ──────────→ │ pending │ ──────────→ │ firing │
 *   └────────┘             └─────────┘             └────────┘
 *        ↑                                              │
 *        │              条件不再满足                      │
 *        └──────────────────────────────────────────────┘
 *                                    (发送 resolved 通知)
 *
 *   pending 状态的作用：防止指标抖动导致频繁告警
 *   例如：错误率瞬间飙到 6%，但 2 秒后恢复正常
 *   如果没有 pending 状态，就会发出一个无意义的告警
 */

import { MetricsSnapshot } from './metrics';

// ==================== 类型定义 ====================

/** 告警严重级别 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/** 告警状态 */
export type AlertStatus = 'normal' | 'pending' | 'firing' | 'resolved';

/** 告警规则定义 */
export interface AlertRule {
    /** 规则唯一标识 */
    name: string;
    /** 告警描述模板 */
    description: string;
    /** 严重级别 */
    severity: AlertSeverity;
    /** 评估函数：接收指标快照，返回 true 表示条件满足 */
    condition: (metrics: MetricsSnapshot) => boolean;
    /** 当前值（用于面板和通知展示） */
    getValue: (metrics: MetricsSnapshot) => number | string;
    /** 阈值（用于面板和通知展示） */
    threshold: number | string;
    /** 评估窗口 */
    window: string;
    /** 简短排查建议 */
    suggestion: string;
    /** pending → firing 需要持续多少个评估周期（每周期 10 秒） */
    pendingPeriods: number;
    /** 冷却期（毫秒）：firing 后多久内不重复告警 */
    cooldownMs: number;
}

/** 告警实例（一个规则可能同时有多个告警实例） */
export interface Alert {
    rule: AlertRule;
    status: AlertStatus;
    /** 进入 pending 状态的时间 */
    pendingSince: number | null;
    /** 进入 firing 状态的时间 */
    firedAt: number | null;
    /** 上次发送通知的时间 */
    lastNotifiedAt: number | null;
    /** 触发时的指标快照（用于通知中展示） */
    triggerSnapshot: MetricsSnapshot | null;
    /** 最近恢复时间 */
    resolvedAt: number | null;
}

/** 告警事件 — 发送给通知器 */
export interface AlertEvent {
    type: 'firing' | 'resolved';
    alert: Alert;
    snapshot: MetricsSnapshot;
    timestamp: number;
}

// ==================== 默认告警规则 ====================

const readNumberEnv = (name: string, defaultValue: number): number => {
    const raw = process.env[name];
    if (!raw) return defaultValue;
    const value = Number(raw);
    return Number.isFinite(value) ? value : defaultValue;
};

const readIntEnv = (name: string, defaultValue: number): number => {
    return Math.max(1, Math.floor(readNumberEnv(name, defaultValue)));
};

const thresholds = {
    errorRatePercent: readNumberEnv('ALERT_ERROR_RATE_PERCENT', 2),
    errorRateMinRequests: readIntEnv('ALERT_ERROR_RATE_MIN_REQUESTS', 20),
    serviceDownMinRequests: readIntEnv('ALERT_SERVICE_DOWN_MIN_REQUESTS', 5),
    latencyP95Ms: readIntEnv('ALERT_LATENCY_P95_MS', 800),
    latencyMinSamples: readIntEnv('ALERT_LATENCY_MIN_SAMPLES', 30),
    memoryUsageMB: readIntEnv('ALERT_MEMORY_MB', 350),
    eventLoopLagMs: readIntEnv('ALERT_EVENT_LOOP_LAG_MS', 200),
    cooldownMs: readIntEnv('ALERT_COOLDOWN_MS', 5 * 60 * 1000),
};

export const DEFAULT_RULES: AlertRule[] = [
    {
        name: 'high_error_rate',
        description: `1 分钟 5xx 错误率过高: {{rate}}% (阈值 ${thresholds.errorRatePercent}%)`,
        severity: 'critical',
        condition: (m) =>
            m.windows.oneMinute.requests >= thresholds.errorRateMinRequests &&
            m.windows.oneMinute.errorRatePercent >= thresholds.errorRatePercent,
        getValue: (m) => m.windows.oneMinute.errorRatePercent,
        threshold: `${thresholds.errorRatePercent}% / minRequests=${thresholds.errorRateMinRequests}`,
        window: '1m',
        suggestion: '查看 /api/metrics 的 5xx 状态码分布，再检查 backend 容器日志和最近发布。',
        pendingPeriods: 2,
        cooldownMs: thresholds.cooldownMs,
    },
    {
        name: 'high_latency_p95',
        description: `1 分钟 P95 响应时间过高: {{p95}}ms (阈值 ${thresholds.latencyP95Ms}ms)`,
        severity: 'warning',
        condition: (m) =>
            m.windows.oneMinute.latency.count >= thresholds.latencyMinSamples &&
            m.windows.oneMinute.latency.p95 >= thresholds.latencyP95Ms,
        getValue: (m) => m.windows.oneMinute.latency.p95,
        threshold: `${thresholds.latencyP95Ms}ms / samples=${thresholds.latencyMinSamples}`,
        window: '1m',
        suggestion: '检查慢接口、数据库依赖延迟、CPU/内存压力；wrk slow 测试结束后应自动恢复。',
        pendingPeriods: 2,
        cooldownMs: thresholds.cooldownMs,
    },
    {
        name: 'high_memory_usage',
        description: `内存使用过高: {{memory}}MB (阈值 ${thresholds.memoryUsageMB}MB)`,
        severity: 'warning',
        condition: (m) => m.system.memoryUsageMB >= thresholds.memoryUsageMB,
        getValue: (m) => m.system.memoryUsageMB,
        threshold: `${thresholds.memoryUsageMB}MB`,
        window: 'latest',
        suggestion: '检查是否有大文件解析、图片上传或长时间压测；必要时重启 backend 并观察是否复发。',
        pendingPeriods: 6,
        cooldownMs: 10 * 60 * 1000,
    },
    {
        name: 'service_down',
        description: '服务异常: 1 分钟内所有请求均为 5xx 错误',
        severity: 'critical',
        condition: (m) => {
            return m.windows.oneMinute.requests >= thresholds.serviceDownMinRequests &&
                m.windows.oneMinute.errorRatePercent === 100;
        },
        getValue: (m) => `${m.windows.oneMinute.errorRatePercent}%`,
        threshold: `100% / minRequests=${thresholds.serviceDownMinRequests}`,
        window: '1m',
        suggestion: '优先查看 /api/ready、backend 日志、MongoDB/Redis/PostgreSQL 容器健康状态。',
        pendingPeriods: 1,
        cooldownMs: 3 * 60 * 1000,
    },
    {
        name: 'dependency_down',
        description: '依赖异常: {{dependency}}',
        severity: 'critical',
        condition: (m) => Object.values(m.system.dependencies).some(dep => dep.status === 'down'),
        getValue: (m) => {
            const down = Object.entries(m.system.dependencies)
                .filter(([, dep]) => dep.status === 'down')
                .map(([name]) => name);
            return down.length > 0 ? down.join(', ') : 'none';
        },
        threshold: 'all dependencies up',
        window: 'latest',
        suggestion: '查看 /api/ready 输出的依赖错误，优先恢复 down 的数据库或缓存容器。',
        pendingPeriods: 2,
        cooldownMs: thresholds.cooldownMs,
    },
    {
        name: 'event_loop_lag',
        description: `事件循环阻塞过高: {{eventLoopLag}}ms (阈值 ${thresholds.eventLoopLagMs}ms)`,
        severity: 'warning',
        condition: (m) => m.system.eventLoopLagMs >= thresholds.eventLoopLagMs,
        getValue: (m) => m.system.eventLoopLagMs,
        threshold: `${thresholds.eventLoopLagMs}ms`,
        window: 'latest',
        suggestion: '检查 CPU 密集任务、同步文件处理、文档解析或压测并发是否过高。',
        pendingPeriods: 3,
        cooldownMs: thresholds.cooldownMs,
    },
];

// ==================== 告警管理器 ====================

export type AlertEventHandler = (event: AlertEvent) => void;

export class AlertManager {
    private rules: AlertRule[];
    private alerts: Map<string, Alert> = new Map();
    private eventHandlers: AlertEventHandler[] = [];
    private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

    constructor(rules: AlertRule[] = DEFAULT_RULES) {
        this.rules = rules;

        // 初始化所有规则的告警实例
        for (const rule of rules) {
            this.alerts.set(rule.name, {
                rule,
                status: 'normal',
                pendingSince: null,
                firedAt: null,
                lastNotifiedAt: null,
                triggerSnapshot: null,
                resolvedAt: null,
            });
        }
    }

    /**
     * 注册告警事件处理器
     * 当告警触发或恢复时，会调用所有注册的处理器
     */
    onAlert(handler: AlertEventHandler): void {
        this.eventHandlers.push(handler);
    }

    /**
     * 评估所有规则 — 由外部定时调用（每 10 秒）
     */
    evaluate(snapshot: MetricsSnapshot): void {
        for (const [, alert] of this.alerts) {
            const conditionMet = alert.rule.condition(snapshot);
            this.transition(alert, conditionMet, snapshot);
        }
    }

    /**
     * 状态机转换逻辑 — 这是告警系统的核心
     */
    private transition(alert: Alert, conditionMet: boolean, snapshot: MetricsSnapshot): void {
        const now = Date.now();

        switch (alert.status) {
            case 'normal':
                if (conditionMet) {
                    alert.status = 'pending';
                    alert.pendingSince = now;
                    console.log(`[Alert] ${alert.rule.name}: normal → pending`);
                }
                break;

            case 'pending':
                if (!conditionMet) {
                    alert.status = 'normal';
                    alert.pendingSince = null;
                    console.log(`[Alert] ${alert.rule.name}: pending → normal (条件消失)`);
                } else {
                    const pendingDuration = now - (alert.pendingSince || now);
                    const requiredDuration = alert.rule.pendingPeriods * 10_000;

                    if (pendingDuration >= requiredDuration) {
                        const sinceLastFired = alert.firedAt ? now - alert.firedAt : Infinity;
                        if (sinceLastFired >= alert.rule.cooldownMs) {
                            alert.status = 'firing';
                            alert.firedAt = now;
                            alert.lastNotifiedAt = now;
                            alert.triggerSnapshot = snapshot;
                            alert.resolvedAt = null;
                            console.log(`[Alert] ${alert.rule.name}: pending → FIRING`);
                            this.emitEvent('firing', alert, snapshot);
                        } else {
                            alert.status = 'normal';
                            alert.pendingSince = null;
                            console.log(`[Alert] ${alert.rule.name}: pending → normal (冷却期)`);
                        }
                    }
                }
                break;

            case 'firing':
                if (!conditionMet) {
                    alert.status = 'resolved';
                    alert.pendingSince = null;
                    alert.resolvedAt = now;
                    console.log(`[Alert] ${alert.rule.name}: firing → RESOLVED`);
                    this.emitEvent('resolved', alert, snapshot);

                    const timeout = setTimeout(() => {
                        this.pendingTimeouts.delete(timeout);
                        if (alert.status === 'resolved') {
                            alert.status = 'normal';
                        }
                    }, 30_000);
                    this.pendingTimeouts.add(timeout);
                }
                break;

            case 'resolved':
                if (conditionMet) {
                    alert.status = 'pending';
                    alert.pendingSince = now;
                    console.log(`[Alert] ${alert.rule.name}: resolved → pending (复发)`);
                }
                break;
        }
    }

    private emitEvent(type: AlertEvent['type'], alert: Alert, snapshot: MetricsSnapshot): void {
        const event: AlertEvent = {
            type,
            alert,
            snapshot,
            timestamp: Date.now(),
        };

        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            } catch (err) {
                console.error(`[AlertManager] Event handler error:`, err);
            }
        }
    }

    /**
     * 获取所有告警的当前状态
     */
    getStatus(snapshot?: MetricsSnapshot): Array<{
        name: string;
        status: AlertStatus;
        severity: AlertSeverity;
        description: string;
        currentValue?: number | string;
        threshold: number | string;
        window: string;
        suggestion: string;
        pendingPeriods: number;
        pendingElapsedPeriods: number;
        pendingRemainingPeriods: number;
        lastFiredAt: string | null;
        lastResolvedAt: string | null;
    }> {
        const now = Date.now();
        return Array.from(this.alerts.values()).map(alert => ({
            name: alert.rule.name,
            status: alert.status,
            severity: alert.rule.severity,
            description: alert.rule.description,
            currentValue: snapshot ? alert.rule.getValue(snapshot) : undefined,
            threshold: alert.rule.threshold,
            window: alert.rule.window,
            suggestion: alert.rule.suggestion,
            pendingPeriods: alert.rule.pendingPeriods,
            pendingElapsedPeriods: alert.pendingSince
                ? Math.floor((now - alert.pendingSince) / 10_000)
                : 0,
            pendingRemainingPeriods: alert.status === 'pending' && alert.pendingSince
                ? Math.max(0, alert.rule.pendingPeriods - Math.floor((now - alert.pendingSince) / 10_000))
                : 0,
            lastFiredAt: alert.firedAt ? new Date(alert.firedAt).toISOString() : null,
            lastResolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt).toISOString() : null,
        }));
    }

    destroy(): void {
        for (const timeout of this.pendingTimeouts) {
            clearTimeout(timeout);
        }
        this.pendingTimeouts.clear();
    }
}
