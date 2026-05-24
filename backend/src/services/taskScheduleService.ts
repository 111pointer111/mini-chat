import ScheduledTask, { IScheduledTask } from '../models/ScheduledTask';
import { computeNextRunTime } from '../utils/timeUtils';
import { SCHEDULED_TASK_JOB_NAME, taskQueue } from './taskQueue';

const SCHEDULER_PREFIX = 'scheduled-task';

type SchedulableTask = Pick<IScheduledTask, '_id' | 'enabled' | 'pushTime' | 'timezone' | 'nextRunAt'>;

const parsePushTime = (pushTime: string) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(pushTime);
    if (!match) {
        throw new Error(`Invalid pushTime: ${pushTime}`);
    }

    return {
        hour: Number.parseInt(match[1], 10),
        minute: Number.parseInt(match[2], 10),
    };
};

export const getTaskSchedulerId = (taskId: string) => `${SCHEDULER_PREFIX}:${taskId}`;

export const buildDailyCronPattern = (pushTime: string) => {
    const { hour, minute } = parsePushTime(pushTime);
    return `${minute} ${hour} * * *`;
};

export const syncTaskScheduler = async (task: SchedulableTask) => {
    const taskId = task._id.toString();
    const schedulerId = getTaskSchedulerId(taskId);

    if (!task.enabled) {
        await taskQueue.removeJobScheduler(schedulerId);
        return;
    }

    await taskQueue.upsertJobScheduler(
        schedulerId,
        {
            pattern: buildDailyCronPattern(task.pushTime),
            tz: task.timezone || 'Asia/Shanghai',
        },
        {
            name: SCHEDULED_TASK_JOB_NAME,
            data: { taskId },
            opts: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 60000,
                },
                removeOnComplete: true,
                removeOnFail: 100,
            },
        },
    );
};

export const updateTaskNextRunAt = (task: SchedulableTask) => {
    task.nextRunAt = task.enabled
        ? computeNextRunTime(task.pushTime, task.timezone || 'Asia/Shanghai')
        : null;
};

export const removeTaskScheduler = async (taskId: string) => {
    await taskQueue.removeJobScheduler(getTaskSchedulerId(taskId));
};

export const reconcileTaskSchedulers = async () => {
    const enabledTasks = await ScheduledTask.find({ enabled: true });
    const enabledSchedulerIds = new Set<string>();

    for (const task of enabledTasks) {
        updateTaskNextRunAt(task);
        await task.save();
        await syncTaskScheduler(task);
        enabledSchedulerIds.add(getTaskSchedulerId(task._id.toString()));
    }

    const schedulers = await taskQueue.getJobSchedulers(0, -1, true);
    for (const scheduler of schedulers) {
        if (scheduler.key.startsWith(`${SCHEDULER_PREFIX}:`) && !enabledSchedulerIds.has(scheduler.key)) {
            await taskQueue.removeJobScheduler(scheduler.key);
        }
    }

    console.log(`[TaskScheduler] Reconciled ${enabledTasks.length} enabled scheduled tasks`);
};
