import mongoose, { Document, Schema } from 'mongoose';

export type TaskType = 'github_trending' | 'daily_poem' | 'daily_english' | 'custom';

export interface IScheduledTask extends Document {
    userId: mongoose.Types.ObjectId;
    taskType: TaskType;
    taskName: string; // 任务名称
    prompt?: string; // 自定义任务的提示词（仅 custom 类型需要）
    enabled: boolean;
    pushTime: string; // "HH:mm" format, e.g., "09:00"
    timezone: string; // IANA timezone, e.g., "Asia/Shanghai"
    conversationId?: mongoose.Types.ObjectId;
    nextRunAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const scheduledTaskSchema = new Schema<IScheduledTask>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        taskType: {
            type: String,
            enum: ['github_trending', 'daily_poem', 'daily_english', 'custom'],
            required: true,
        },
        taskName: {
            type: String,
            required: true,
        },
        prompt: {
            type: String,
        },
        enabled: {
            type: Boolean,
            default: false,
        },
        pushTime: {
            type: String,
            default: '09:00',
            validate: {
                validator: (v: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(v),
                message: 'pushTime must be in HH:mm format',
            },
        },
        timezone: {
            type: String,
            default: 'Asia/Shanghai',
        },
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
        },
        nextRunAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: one task type per user (for preset tasks)
// Custom tasks can have multiple per user
scheduledTaskSchema.index({ userId: 1, taskType: 1 }, { 
    unique: true,
    partialFilterExpression: { taskType: { $ne: 'custom' } }
});
scheduledTaskSchema.index({ userId: 1 });
scheduledTaskSchema.index({ enabled: 1, nextRunAt: 1 });

export default mongoose.model<IScheduledTask>('ScheduledTask', scheduledTaskSchema);
