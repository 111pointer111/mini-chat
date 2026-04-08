import mongoose, { Document, Schema } from 'mongoose';
import { TaskType } from './ScheduledTask';

export interface IPushHistory extends Document {
    userId: mongoose.Types.ObjectId;
    taskType: TaskType;
    contentHash: string; // MD5 hash for deduplication
    content: string;     // Actual content pushed
    pushedAt: Date;
}

const pushHistorySchema = new Schema<IPushHistory>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        taskType: {
            type: String,
            required: true,
        },
        contentHash: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        pushedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false,
    }
);

// Index for efficient querying
pushHistorySchema.index({ userId: 1, taskType: 1 });
pushHistorySchema.index({ userId: 1, taskType: 1, contentHash: 1 });
pushHistorySchema.index({ pushedAt: -1 }); // For sorting by most recent

export default mongoose.model<IPushHistory>('PushHistory', pushHistorySchema);
