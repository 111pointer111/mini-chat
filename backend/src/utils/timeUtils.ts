export function computeNextRunTime(pushTime: string, timezone: string): Date {
    const [targetHour, targetMinute] = pushTime.split(':').map(Number);
    const now = new Date();
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    for (let ms = 0; ms < 2 * 86400000; ms += 60000) {
        const candidate = new Date(nextMinute.getTime() + ms);
        const parts = formatter.formatToParts(candidate);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
        if (hour === targetHour && minute === targetMinute) {
            return candidate;
        }
    }

    return new Date(now.getTime() + 86400000);
}
