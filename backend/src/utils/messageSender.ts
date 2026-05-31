import { Types } from 'mongoose';
import { AI_ASSISTANT_ID } from '../scripts/initAdmin';

type SenderValue = string | Types.ObjectId | { _id?: unknown; [key: string]: unknown } | null | undefined;
type MessageWithSender = { sender?: SenderValue };

export const AI_ASSISTANT_SENDER = {
    _id: AI_ASSISTANT_ID.toString(),
    username: '群聊小助手',
    avatar: '',
};

export function getSenderId(sender: SenderValue): string {
    if (!sender) return '';
    if (typeof sender === 'string') return sender;
    if (sender instanceof Types.ObjectId) return sender.toString();
    if (typeof sender === 'object' && '_id' in sender && sender._id) {
        return String(sender._id);
    }
    return '';
}

export function normalizeMessageSender<T extends MessageWithSender>(message: T, originalSender?: SenderValue): T {
    const originalSenderId = getSenderId(originalSender ?? message.sender);

    if (originalSenderId === AI_ASSISTANT_ID.toString()) {
        return { ...message, sender: AI_ASSISTANT_SENDER } as T;
    }

    if (
        message.sender &&
        typeof message.sender === 'object' &&
        !(message.sender instanceof Types.ObjectId) &&
        '_id' in message.sender &&
        message.sender._id
    ) {
        return {
            ...message,
            sender: {
                ...message.sender,
                _id: String(message.sender._id),
            },
        } as T;
    }

    return message;
}
