/**
 * 告警通知器
 *
 * 负责将告警事件通过不同渠道发送出去
 *
 * 通知渠道：
 *   1. WebSocket — 实时推送到前端（通过 Socket.IO room）
 *   2. Email — 通过 SMTP 发送告警邮件
 *   3. Console — 控制台输出（开发调试用）
 *
 * 设计原则：
 *   - 每个渠道独立，一个渠道失败不影响其他渠道
 *   - 通知内容格式化为人类可读的消息
 *   - 支持按严重级别过滤（例如：critical 才发邮件）
 */

import nodemailer from 'nodemailer';
import { AlertEvent, AlertSeverity } from './alertManager';

// ==================== 通知渠道接口 ====================

/** 通知渠道必须实现这个接口 */
export interface NotificationChannel {
    name: string;
    send(event: AlertEvent, message: string): Promise<void>;
}

// ==================== WebSocket 通知渠道 ====================

/**
 * 通过 Socket.IO 推送告警到前端
 *
 * 前端可以监听 'alert' 事件来接收告警：
 *   socket.on('alert', (data) => { ... })
 *
 * 使用 room 机制：只有加入 'alerts' room 的客户端才会收到
 */
export class WebSocketChannel implements NotificationChannel {
    name = 'websocket';
    private getIO: () => import('socket.io').Server;

    constructor(getIO: () => import('socket.io').Server) {
        this.getIO = getIO;
    }

    async send(event: AlertEvent, message: string): Promise<void> {
        try {
            const io = this.getIO();
            io.to('alerts').emit('alert', {
                type: event.type,
                severity: event.alert.rule.severity,
                name: event.alert.rule.name,
                message,
                timestamp: event.timestamp,
            });
        } catch (err) {
            console.error('[AlertNotifier] WebSocket send failed:', err);
        }
    }
}

// ==================== 邮件通知渠道 ====================

export interface EmailChannelConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    /** 发件人显示名（如 "微聊天智能助手"） */
    senderName: string;
    to: string;
}

export class EmailChannel implements NotificationChannel {
    name = 'email';
    private transporter: nodemailer.Transporter;
    private from: string;
    private to: string;

    constructor(config: EmailChannelConfig) {
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: { user: config.user, pass: config.pass },
        });
        // RFC 2822 格式: "显示名" <邮箱地址>
        this.from = config.senderName
            ? `"${config.senderName}" <${config.user}>`
            : config.user;
        this.to = config.to;
    }

    async send(event: AlertEvent, message: string): Promise<void> {
        const severity = event.alert.rule.severity.toUpperCase();
        const subject = `[${severity}] 告警${event.type === 'firing' ? '触发' : '恢复'}: ${event.alert.rule.name}`;

        // 纯文本版本（去掉 markdown 加粗符号）
        const text = message.replace(/\*\*/g, '');

        // HTML 版本
        const html = this.toHtml(event, message);

        try {
            await this.transporter.sendMail({
                from: this.from,
                to: this.to,
                subject,
                text,
                html,
            });
        } catch (err) {
            console.error('[AlertNotifier] Email send failed:', err);
        }
    }

    private toHtml(event: AlertEvent, message: string): string {
        const { alert, type, timestamp } = event;
        const isFiring = type === 'firing';
        const borderColor = isFiring
            ? (alert.rule.severity === 'critical' ? '#d32f2f' : '#ed6c02')
            : '#2e7d32';
        const bgColor = isFiring ? '#fff3e0' : '#e8f5e9';
        const time = new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

        // 把 markdown 格式转为 HTML
        const htmlMessage = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/---/g, '<hr>');

        return `
<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="border-left: 4px solid ${borderColor}; padding: 16px; background: ${bgColor}; border-radius: 4px;">
        <h3 style="margin: 0 0 12px; color: ${borderColor};">
            ${isFiring ? '告警触发' : '告警恢复'}: ${alert.rule.name}
        </h3>
        <div style="font-size: 14px; line-height: 1.8; color: #333;">
            ${htmlMessage}
        </div>
        <div style="margin-top: 12px; font-size: 12px; color: #666;">
            时间: ${time}
        </div>
    </div>
</div>`;
    }
}

// ==================== 控制台通知渠道（开发/调试用） ====================

export class ConsoleChannel implements NotificationChannel {
    name = 'console';

    async send(event: AlertEvent, message: string): Promise<void> {
        const emoji = event.type === 'firing' ? '🔥' : '✅';
        const prefix = `${emoji} [${event.alert.rule.severity.toUpperCase()}]`;

        if (event.type === 'firing') {
            console.error(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
}

// ==================== 通知器主类 ====================

export class AlertNotifier {
    private channels: NotificationChannel[] = [];

    /** 最低严重级别过滤：低于此级别的告警不发送通知 */
    private minSeverity: AlertSeverity;

    /** 严重级别权重（用于比较） */
    private static severityWeight: Record<AlertSeverity, number> = {
        critical: 3,
        warning: 2,
        info: 1,
    };

    constructor(options: { minSeverity?: AlertSeverity } = {}) {
        this.minSeverity = options.minSeverity || 'warning';
    }

    /**
     * 添加通知渠道
     */
    addChannel(channel: NotificationChannel): this {
        this.channels.push(channel);
        return this;
    }

    /**
     * 处理告警事件 — 格式化消息并发送到所有渠道
     */
    async handleEvent(event: AlertEvent): Promise<void> {
        // 严重级别过滤
        if (!this.shouldNotify(event.alert.rule.severity)) {
            return;
        }

        // 格式化消息
        const message = this.formatMessage(event);

        // 并行发送到所有渠道（allSettled 原生处理 rejection）
        const results = await Promise.allSettled(
            this.channels.map(channel => channel.send(event, message))
        );

        // 记录失败的渠道
        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.error(`[AlertNotifier] Channel "${this.channels[i]?.name}" failed:`, result.reason);
            }
        });
    }

    /**
     * 判断是否应该发送通知
     */
    private shouldNotify(severity: AlertSeverity): boolean {
        return AlertNotifier.severityWeight[severity] >= AlertNotifier.severityWeight[this.minSeverity];
    }

    /**
     * 格式化告警消息
     *
     * 输出格式示例：
     *   🔥 [CRITICAL] 5xx 错误率过高
     *   错误率: 8.5% (阈值 5%)
     *   时间: 2026-05-20 14:30:00
     */
    private formatMessage(event: AlertEvent): string {
        const { alert, snapshot, type, timestamp } = event;
        const emoji = type === 'firing' ? '🔥' : '✅';
        const action = type === 'firing' ? '触发' : '恢复';
        const time = new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

        let msg = `${emoji} **[${alert.rule.severity.toUpperCase()}] ${alert.rule.name}**\n\n`;
        msg += `状态: 告警${action}\n`;

        // 渲染描述模板
        let desc = alert.rule.description;
        desc = desc.replace('{{rate}}', String(snapshot.errors.ratePercent));
        desc = desc.replace('{{p95}}', String(snapshot.latency.p95));
        desc = desc.replace('{{memory}}', String(snapshot.system.memoryUsageMB));
        desc = desc.replace('{{sockets}}', String(snapshot.system.socketConnections));
        msg += `详情: ${desc}\n`;

        msg += `时间: ${time}\n`;

        if (type === 'firing') {
            msg += `\n---\n`;
            msg += `请求总数: ${snapshot.requests.total}\n`;
            msg += `5xx 错误: ${snapshot.errors.server5xx}\n`;
            msg += `P95 延迟: ${snapshot.latency.p95}ms\n`;
            msg += `内存使用: ${snapshot.system.memoryUsageMB}MB`;
        }

        return msg;
    }
}
