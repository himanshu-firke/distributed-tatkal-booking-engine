const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('connect',  () => console.log('[Booking Redis] Connected'));
redis.on('error',    (err) => console.error('[Booking Redis] Error:', err.message));

module.exports = redis;
