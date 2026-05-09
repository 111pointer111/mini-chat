/**
 * 定时任务创建工具
 * 供 AI Agent 调用，自动创建定时推送任务
 */

import mongoose from 'mongoose';
import ScheduledTask from '../models/ScheduledTask';
import Conversation from '../models/Conversation';
import { computeNextRunTime } from '../utils/timeUtils';

// 工具执行结果接口
export interface ToolResult {
    success: boolean;
    data?: string;
    error?: string;
    suggestion?: string;
}

// 预设任务类型映射
const PRESET_TASK_MAP: Record<string, { taskType: string; taskName: string }> = {
    'github': { taskType: 'github_trending', taskName: 'GitHub 热点' },
    'github_trending': { taskType: 'github_trending', taskName: 'GitHub 热点' },
    '每日诗句': { taskType: 'daily_poem', taskName: '每日诗句' },
    'daily_poem': { taskType: 'daily_poem', taskName: '每日诗句' },
    '每日英文': { taskType: 'daily_english', taskName: '每日英文' },
    'daily_english': { taskType: 'daily_english', taskName: '每日英文' },
};

/**
 * 创建定时任务
 */
export async function createScheduledTask(
    userId: string,
    taskName: string,
    prompt: string,
    pushTime: string = '09:00',
    timezone: string = 'Asia/Shanghai'
): Promise<ToolResult> {
    try {
        // 1. 验证时间格式
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(pushTime)) {
            return {
                success: false,
                error: '时间格式无效',
                suggestion: '请使用 HH:mm 格式，如 "09:00"、"18:30"',
            };
        }

        // 2. 检查是否是预设任务
        const presetKey = taskName.toLowerCase().replace(/\s+/g, '_');
        const preset = PRESET_TASK_MAP[presetKey] || PRESET_TASK_MAP[taskName];

        if (preset) {
            // 预设任务：查找或创建
            let task = await ScheduledTask.findOne({ userId, taskType: preset.taskType });

            if (task) {
                // 更新现有任务
                task.enabled = true;
                task.pushTime = pushTime;
                task.timezone = timezone;
                task.nextRunAt = computeNextRunTime(pushTime, timezone);
                await task.save();

                return {
                    success: true,
                    data: `已更新预设任务「${preset.taskName}」，推送时间：每天 ${pushTime}`,
                };
            }

            // 创建新的预设任务
            const conversation = await Conversation.create({
                userId: new mongoose.Types.ObjectId(userId),
                type: 'scheduled_task',
                name: preset.taskName,
                taskType: preset.taskType,
            });

            task = await ScheduledTask.create({
                userId,
                taskType: preset.taskType,
                taskName: preset.taskName,
                enabled: true,
                pushTime,
                timezone,
                conversationId: conversation._id,
                nextRunAt: computeNextRunTime(pushTime, timezone),
            });

            return {
                success: true,
                data: `已创建预设任务「${preset.taskName}」，推送时间：每天 ${pushTime}`,
            };
        }

        // 3. 自定义任务
        if (!taskName || !prompt) {
            return {
                success: false,
                error: '缺少必要参数',
                suggestion: '请提供任务名称和任务内容描述',
            };
        }

        // 检查是否已存在同名自定义任务
        const existingTask = await ScheduledTask.findOne({
            userId,
            taskType: 'custom',
            taskName,
        });

        if (existingTask) {
            // 更新现有任务
            existingTask.prompt = prompt;
            existingTask.pushTime = pushTime;
            existingTask.timezone = timezone;
            existingTask.enabled = true;
            existingTask.nextRunAt = computeNextRunTime(pushTime, timezone);
            await existingTask.save();

            return {
                success: true,
                data: `已更新自定义任务「${taskName}」，推送时间：每天 ${pushTime}`,
            };
        }

        // 创建新任务
        const conversation = await Conversation.create({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'scheduled_task',
            name: taskName,
            taskType: 'custom',
        });

        const task = await ScheduledTask.create({
            userId,
            taskType: 'custom',
            taskName,
            prompt,
            enabled: true,
            pushTime,
            timezone,
            conversationId: conversation._id,
            nextRunAt: computeNextRunTime(pushTime, timezone),
        });

        return {
            success: true,
            data: `已创建定时任务「${taskName}」，推送时间：每天 ${pushTime}，任务ID：${task._id}`,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('createScheduledTask error:', err);
        return {
            success: false,
            error: msg,
            suggestion: '创建任务失败，请稍后重试',
        };
    }
}

// 工具描述（供 AI 理解）
export const scheduledTaskToolDefinition = {
    type: "function" as const,
    function: {
        name: "create_scheduled_task",
        description: `创建或更新定时推送任务。当用户要求定时推送内容或设置提醒时使用此工具。

适用场景：
- "每天早上9点推送科技新闻"
- "提醒我每天下午6点喝水"
- "每天8点给我讲个故事"
- "帮我设置每天的 GitHub 热点推送"
- "创建一个每日诗句推送"

支持的任务类型：
- 预设任务：GitHub 热点（github/github_trending）、每日诗句（daily_poem）、每日英文（daily_english）
- 自定义任务：用户自定义名称和内容

返回格式示例：
- 成功：已创建定时任务「科技新闻」，推送时间：每天 09:00
- 失败：创建失败：xxx

注意：
- 时间格式必须是 HH:mm（24小时制），如 "09:00"、"18:30"
- 如果用户没有指定时间，默认使用 09:00
- 如果用户没有指定时区，默认使用 Asia/Shanghai`,
        parameters: {
            type: "object",
            properties: {
                taskName: {
                    type: "string",
                    description: "任务名称。可以是预设名称（GitHub 热点、每日诗句、每日英文）或自定义名称",
                    examples: ["GitHub 热点", "科技新闻", "喝水提醒", "每日诗句"]
                },
                prompt: {
                    type: "string",
                    description: "任务内容提示词。AI 会根据这个提示词生成推送内容。预设任务可以留空。",
                    examples: ["推送今天的科技热点新闻", "提醒我多喝水保持健康", "给我推荐一首古诗词"]
                },
                pushTime: {
                    type: "string",
                    description: "推送时间，HH:mm 格式（24小时制）。默认 09:00",
                    examples: ["09:00", "18:30", "08:00", "22:00"]
                },
                timezone: {
                    type: "string",
                    description: "时区，默认 Asia/Shanghai",
                    examples: ["Asia/Shanghai", "America/New_York", "Europe/London"]
                }
            },
            required: ["taskName", "prompt"]
        }
    }
};
