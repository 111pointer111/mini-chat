import type { TaskType } from '../models/ScheduledTask';
import { getIO } from '../socket';
import redis, { createRedisClient } from '../utils/redis';

const SCHEDULED_TASK_MESSAGE_CHANNEL = 'scheduled-task:message';

export interface ScheduledTaskMessageEvent {
    userId: string;
    conversationId: string;
    taskType: TaskType;
    message: {
        _id: string;
        content: string;
        type: string;
        createdAt: string;
    };
}

export const publishScheduledTaskMessage = async (event: ScheduledTaskMessageEvent) => {
    await redis.publish(SCHEDULED_TASK_MESSAGE_CHANNEL, JSON.stringify(event));
};

export const startScheduledTaskEventSubscriber = () => {
    const subscriber = createRedisClient();

    subscriber.on('message', (channel, payload) => {
        if (channel !== SCHEDULED_TASK_MESSAGE_CHANNEL) {
            return;
        }

        try {
            const event = JSON.parse(payload) as ScheduledTaskMessageEvent;
            getIO().to(event.userId).emit('scheduled_task_message', {
                conversationId: event.conversationId,
                taskType: event.taskType,
                message: event.message,
            });
        } catch (error) {
            console.error('[ScheduledTaskEvents] Failed to publish socket event:', error);
        }
    });

    subscriber.subscribe(SCHEDULED_TASK_MESSAGE_CHANNEL)
        .then(() => console.log('[ScheduledTaskEvents] Subscriber started'))
        .catch((error) => console.error('[ScheduledTaskEvents] Subscribe failed:', error));

    return async () => {
        await subscriber.unsubscribe(SCHEDULED_TASK_MESSAGE_CHANNEL);
        await subscriber.quit();
    };
};
