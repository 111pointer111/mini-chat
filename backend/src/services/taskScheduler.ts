import cron from 'node-cron';
import ScheduledTask from '../models/ScheduledTask';
import { addTaskToQueue } from './taskQueue';
import { computeNextRunTime } from '../utils/timeUtils';

export const startTaskScheduler = () => {
    console.log('Task scheduler started');

    cron.schedule('* * * * *', async () => {
        const now = new Date();
        console.log(`[Scheduler] Checking tasks at ${now.toISOString()}`);

        try {
            // Initialize tasks without nextRunAt (migration)
            const uninitialized = await ScheduledTask.find({
                enabled: true,
                nextRunAt: null,
            });
            for (const task of uninitialized) {
                task.nextRunAt = computeNextRunTime(task.pushTime, task.timezone || 'Asia/Shanghai');
                await task.save();
            }

            // Only fetch tasks that are due, using index
            const dueTasks = await ScheduledTask.find({
                enabled: true,
                nextRunAt: { $lte: now },
            });

            if (dueTasks.length === 0) {
                return;
            }

            console.log(`[Scheduler] Found ${dueTasks.length} tasks to run`);

            for (const task of dueTasks) {
                const delayMs = Math.random() * 30 * 1000;
                console.log(`[Scheduler] Queuing task ${task.taskType} for user ${task.userId} in ${Math.round(delayMs / 1000)}s`);

                try {
                    await addTaskToQueue(
                        task._id.toString(),
                        task.userId.toString(),
                        task.taskType,
                        delayMs,
                    );

                    task.nextRunAt = computeNextRunTime(task.pushTime, task.timezone || 'Asia/Shanghai');
                    await task.save();

                    console.log(`[Scheduler] Queued task ${task.taskType} for user ${task.userId}, next run at ${task.nextRunAt.toISOString()}`);
                } catch (error) {
                    console.error(`[Scheduler] Failed to queue task:`, error);
                }
            }
        } catch (error) {
            console.error('[Scheduler] Error checking tasks:', error);
        }
    });
};
