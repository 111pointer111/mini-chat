import Redis from 'ioredis';

export const redisConnectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
};

export const createRedisClient = () => new Redis(redisConnectionOptions);

const redis = createRedisClient();

redis.on('connect', () => {
    console.log('Redis connected');
});

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

export default redis;
