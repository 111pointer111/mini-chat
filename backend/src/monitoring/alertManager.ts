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
}

/** 告警事件 — 发送给通知器 */
export interface AlertEvent {
    type: 'firing' | 'resolved';
    alert: Alert;
    snapshot: MetricsSnapshot;
    timestamp: number;
}

// ==================== 默认告警规则 ====================

export const DEFAULT_RULES: AlertRule[] = [
    {
        name: 'high_error_rate',
        description: '5xx 错误率过高: {{rate}}% (阈值 5%)',
        severity: 'critical',
        condition: (m) => m.errors.ratePercent > 5,
        pendingPeriods: 3,   // 持续 30 秒才确认
        cooldownMs: 5 * 60 * 1000,  // 5 分钟冷却
    },
    {
        name: 'high_latency_p95',
        description: 'P95 响应时间过高: {{p95}}ms (阈值 2000ms)',
        severity: 'warning',
        condition: (m) => m.latency.p95 > 2000 && m.latency.count > 100,
        pendingPeriods: 3,
        cooldownMs: 5 * 60 * 1000,
    },
    {
        name: 'high_memory_usage',
        description: '内存使用过高: {{memory}}MB (阈值 512MB)',
        severity: 'warning',
        condition: (m) => m.system.memoryUsageMB > 512,
        pendingPeriods: 6,   // 持续 60 秒
        cooldownMs: 10 * 60 * 1000,
    },
    {
        name: 'service_down',
        description: '服务异常: 最近所有请求均为 5xx 错误',
        severity: 'critical',
        condition: (m) => {
            return m.requests.windowed > 0 && m.errors.ratePercent === 100;
        },
        pendingPeriods: 2,
        cooldownMs: 3 * 60 * 1000,
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
                    console.log(`[Alert] ${alert.rule.name}: firing → RESOLVED`);
                    this.emitEvent('resolved', alert, snapshot);

                    const timeout = setTimeout(() => {
                        this.pendingTimeouts.delete(timeout);
                        if (alert.status === 'resolved') {
                            alert.status = 'normal';
                            alert.firedAt = null;
                            alert.triggerSnapshot = null;
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
    getStatus(): Array<{ name: string; status: AlertStatus; severity: AlertSeverity; description: string }> {
        return Array.from(this.alerts.values()).map(alert => ({
            name: alert.rule.name,
            status: alert.status,
            severity: alert.rule.severity,
            description: alert.rule.description,
        }));
    }

    destroy(): void {
        for (const timeout of this.pendingTimeouts) {
            clearTimeout(timeout);
        }
        this.pendingTimeouts.clear();
    }
}
