import mongoose, { Document, Schema } from 'mongoose';

export type ConversationType = 'ai' | 'friend' | 'scheduled_task';

export interface IConversation extends Document {
    userId: mongoose.Types.ObjectId;
    type: ConversationType;
    name: string;
    taskType?: string; // For scheduled_task type: 'github_trending' | 'daily_poem' | 'daily_english'
    participantId?: mongoose.Types.ObjectId; // For friend type: the other user's ID
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['ai', 'friend', 'scheduled_task'],
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        taskType: {
            type: String,
            enum: ['github_trending', 'daily_poem', 'daily_english'],
        },
        participantId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        lastMessageAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient querying
conversationSchema.index({ userId: 1, type: 1 });
conversationSchema.index({ userId: 1, taskType: 1 });

export default mongoose.model<IConversation>('Conversation', conversationSchema);
