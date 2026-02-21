import cron from 'node-cron';
import ScheduledTask from '../models/ScheduledTask';
import { addTaskToQueue } from './taskQueue';

// Get current time in a specific timezone
const getTimeInTimezone = (timezone: string): string => {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const parts = formatter.formatToParts(now);
        const hour = parts.find(p => p.type === 'hour')?.value || '00';
        const minute = parts.find(p => p.type === 'minute')?.value || '00';
        return `${hour}:${minute}`;
    } catch {
        // Fallback to UTC if timezone is invalid
        const now = new Date();
        return `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    }
};

// Check and schedule tasks every minute
export const startTaskScheduler = () => {
    console.log('Task scheduler started');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        console.log(`[Scheduler] Checking tasks at ${now.toISOString()}`);

        try {
            // Find all enabled tasks
            const enabledTasks = await ScheduledTask.find({ enabled: true });

            if (enabledTasks.length === 0) {
                return;
            }

            // Check each task against its own timezone
            const tasksToRun = enabledTasks.filter(task => {
                const userTime = getTimeInTimezone(task.timezone || 'Asia/Shanghai');
                const shouldRun = userTime === task.pushTime;
                if (shouldRun) {
                    console.log(`[Scheduler] Task ${task.taskType} matches: user timezone ${task.timezone} time ${userTime} = pushTime ${task.pushTime}`);
                }
                return shouldRun;
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
