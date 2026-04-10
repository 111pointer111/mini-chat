import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    sender: mongoose.Types.ObjectId;
    receiver: mongoose.Types.ObjectId;
    conversationId?: mongoose.Types.ObjectId;
    content: string;
    type: 'text' | 'image' | 'system';
    images?: string[]; // AI 对话中的图片 URL 列表
    read: boolean;
    createdAt: Date;
}

const MessageSchema: Schema = new Schema({
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'system'], default: 'text' },
    images: { type: [String], default: [] }, // AI 对话中的图片列表
    read: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Index for faster queries of chat history
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
