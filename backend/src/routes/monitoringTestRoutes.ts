import express from 'express';

const MAX_SLOW_MS = 5000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const readBoundedInt = (
    value: unknown,
    defaultValue: number,
    min: number,
    max: number
): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return defaultValue;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
};

export function createMonitoringTestRoutes() {
    const router = express.Router();

    router.use((req, res, next) => {
        const token = process.env.MONITORING_TEST_TOKEN;

        if (process.env.NODE_ENV === 'production' && !token) {
            return res.status(404).json({ message: 'Not found' });
        }

        if (token && req.header('X-Monitoring-Test-Token') !== token) {
            return res.status(404).json({ message: 'Not found' });
        }

        next();
    });

    router.get('/ok', (_req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
        });
    });

    router.get('/slow', async (req, res) => {
        const ms = readBoundedInt(req.query.ms, 1000, 0, MAX_SLOW_MS);
        await sleep(ms);
        res.json({
            status: 'ok',
            delayMs: ms,
            timestamp: new Date().toISOString(),
        });
    });

    router.get('/error', (req, res) => {
        const status = readBoundedInt(req.query.status, 500, 400, 599);
        res.status(status).json({
            status: 'error',
            testStatus: status,
            timestamp: new Date().toISOString(),
        });
    });

    return router;
}
