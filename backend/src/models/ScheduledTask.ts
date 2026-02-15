import mongoose, { Document, Schema } from 'mongoose';

export type TaskType = 'github_trending' | 'daily_poem' | 'daily_english';

export interface IScheduledTask extends Document {
    userId: mongoose.Types.ObjectId;
    taskType: TaskType;
    enabled: boolean;
    pushTime: string; // "HH:mm" format, e.g., "09:00"
    conversationId?: mongoose.Types.ObjectId;
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
            enum: ['github_trending', 'daily_poem', 'daily_english'],
            required: true,
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
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: one task type per user
scheduledTaskSchema.index({ userId: 1, taskType: 1 }, { unique: true });

export default mongoose.model<IScheduledTask>('ScheduledTask', scheduledTaskSchema);
