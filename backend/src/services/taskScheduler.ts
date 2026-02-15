import cron from 'node-cron';
import ScheduledTask from '../models/ScheduledTask';
import { addTaskToQueue } from './taskQueue';

// Check and schedule tasks every minute
export const startTaskScheduler = () => {
    console.log('Task scheduler started');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        console.log(`[Scheduler] Checking tasks at ${currentTime}`);

        try {
            // Find all enabled tasks that should run at current time
            const tasksToRun = await ScheduledTask.find({
                enabled: true,
                pushTime: currentTime,
            });

            if (tasksToRun.length > 0) {
                console.log(`[Scheduler] Found ${tasksToRun.length} tasks to run`);

                for (const task of tasksToRun) {
                    // Add small random delay (0-30 seconds) to avoid rate limiting
                    const delayMs = Math.random() * 30 * 1000;
                    console.log(`[Scheduler] Will queue task ${task.taskType} in ${Math.round(delayMs / 1000)}s`);

                    setTimeout(async () => {
                        try {
                            console.log(`[Scheduler] Adding task ${task.taskType} to queue...`);
                            await addTaskToQueue(
                                task._id.toString(),
                                task.userId.toString(),
                                task.taskType
                            );
                            console.log(`[Scheduler] Queued task ${task.taskType} for user ${task.userId}`);
                        } catch (error) {
                            console.error(`[Scheduler] Failed to queue task:`, error);
                        }
                    }, delayMs);
                }
            }
        } catch (error) {
            console.error('[Scheduler] Error checking tasks:', error);
        }
    });
};
