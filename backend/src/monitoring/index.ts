/**
 * 监控模块入口
 *
 * 提供便捷的 setupMonitoring() 函数，一行代码完成所有监控初始化
 */

import { metrics, MetricsCollector, MetricsSnapshot } from './metrics';
import { metricsMiddleware, errorHandlerMiddleware } from './middleware';
import { AlertManager, AlertRule, DEFAULT_RULES, AlertEvent } from './alertManager';
import {
    AlertNotifier,
    WebSocketChannel,
    EmailChannel,
    ConsoleChannel,
    NotificationChannel,
} from './alertNotifier';
import { Application } from 'express';
import { Server } from 'socket.io';

export interface MonitoringConfig {
    /** 自定义告警规则（不传则使用默认规则） */
    rules?: AlertRule[];
    /** 最低通知严重级别 */
    minSeverity?: 'critical' | 'warning' | 'info';
    /** 告警邮件接收人（不配则不发邮件） */
    alertEmail?: string;
    /** SMTP 主机 */
    smtpHost?: string;
    /** SMTP 端口 */
    smtpPort?: string;
    /** SMTP 用户名 */
    smtpUser?: string;
    /** SMTP 密码 */
    smtpPass?: string;
    /** 发件人地址 */
    smtpSender?: string;
    /** 是否启用控制台通知（默认 true） */
    enableConsole?: boolean;
    /** 是否启用 WebSocket 通知（默认 true） */
    enableWebSocket?: boolean;
    /** Socket.IO 实例获取函数（启用 WebSocket 通知时必须提供） */
    getIO?: () => Server;
}

export interface MonitoringHandle {
    /** 指标收集器 */
    metrics: MetricsCollector;
    /** 告警管理器 */
    alertManager: AlertManager;
    /** 告警通知器 */
    notifier: AlertNotifier;
    /** 手动获取指标快照 */
    getSnapshot: () => MetricsSnapshot;
    /** 手动触发告警评估 */
    evaluate: () => void;
    /** 销毁（清理定时器） */
    destroy: () => void;
}

/**
 * 初始化监控系统
 *
 * 用法：
 *   const monitoring = setupMonitoring(app);
 *   // 就这样，所有东西都自动运行了
 */
export function setupMonitoring(
    app: Application,
    config: MonitoringConfig = {}
): MonitoringHandle {
    const {
        rules = DEFAULT_RULES,
        minSeverity = 'warning',
        alertEmail,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpSender,
        enableConsole = true,
        enableWebSocket = true,
        getIO,
    } = config;

    // 1. 挂载 Express 中间件（自动收集请求指标）
    app.use(metricsMiddleware);

    // 2. 创建告警管理器
    const alertManager = new AlertManager(rules);

    // 3. 创建通知器并注册渠道
    const notifier = new AlertNotifier({ minSeverity });

    if (enableWebSocket && getIO) {
        notifier.addChannel(new WebSocketChannel(getIO));
    }
    if (alertEmail && smtpHost && smtpUser && smtpPass) {
        notifier.addChannel(new EmailChannel({
            host: smtpHost,
            port: Number(smtpPort) || 465,
            user: smtpUser,
            pass: smtpPass,
            senderName: smtpSender || '',
            to: alertEmail,
        }));
    }
    if (enableConsole) {
        notifier.addChannel(new ConsoleChannel());
    }

    // 4. 连接：告警事件 → 通知器
    alertManager.onAlert((event: AlertEvent) => {
        notifier.handleEvent(event);
    });

    // 5. 定时评估：每 10 秒获取指标快照并评估告警规则
    const evalTimer = setInterval(() => {
        const snapshot = metrics.getSnapshot();
        alertManager.evaluate(snapshot);
    }, 10_000);

    // 6. 错误中间件（放在所有路由之后，由调用方决定放置时机）
    // 注意：这个需要在所有路由注册之后手动添加
    // app.use(errorMetricsMiddleware);

    console.log('✅ Monitoring system initialized');

    return {
        metrics,
        alertManager,
        notifier,
        getSnapshot: () => metrics.getSnapshot(),
        evaluate: () => alertManager.evaluate(metrics.getSnapshot()),
        destroy: () => {
            clearInterval(evalTimer);
            metrics.destroy();
            alertManager.destroy();
        },
    };
}

// 导出所有组件（方便单独使用）
export { metrics } from './metrics';
export { metricsMiddleware, errorHandlerMiddleware } from './middleware';
export { AlertManager, DEFAULT_RULES } from './alertManager';
export { AlertNotifier, WebSocketChannel, EmailChannel, ConsoleChannel } from './alertNotifier';
export type { AlertRule, AlertEvent, Alert, AlertSeverity, AlertStatus } from './alertManager';
export type { MetricsSnapshot } from './metrics';
export type { NotificationChannel } from './alertNotifier';
