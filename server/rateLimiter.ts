import type { Request, Response, NextFunction } from 'express';
import { Database } from './db.ts';

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const keyBuckets = new Map<string, RateLimitBucket>();

// Clean up stale buckets every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of keyBuckets.entries()) {
    if (now - bucket.lastRefill > 120000) {
      keyBuckets.delete(key);
    }
  }
}, 300000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

export function rateLimiter(options: { sensitive?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If request is from internal panel session, apply a generous limit
    if (req.authMethod === 'panel_session') {
      next();
      return;
    }

    const keyIdentifier = req.apiKey?.id || req.ip || 'anonymous';
    const bucketKey = options.sensitive ? `sens_${keyIdentifier}` : `norm_${keyIdentifier}`;

    // Get configurable limit from settings
    const settingKey = options.sensitive ? 'sensitive_rate_limit_per_minute' : 'rate_limit_per_minute';
    const limitPerMinute = parseInt(Database.getSetting(settingKey, options.sensitive ? '30' : '120'), 10) || (options.sensitive ? 30 : 120);

    const now = Date.now();
    let bucket = keyBuckets.get(bucketKey);

    if (!bucket) {
      bucket = { tokens: limitPerMinute, lastRefill: now };
      keyBuckets.set(bucketKey, bucket);
    }

    // Refill tokens based on elapsed time (leaky bucket rate = limitPerMinute / 60000 per ms)
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / 60000) * limitPerMinute;
    bucket.tokens = Math.min(limitPerMinute, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    const resetSeconds = Math.ceil((limitPerMinute - bucket.tokens) / (limitPerMinute / 60));

    res.setHeader('X-RateLimit-Limit', limitPerMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, Math.floor(bucket.tokens)));
    res.setHeader('X-RateLimit-Reset', resetSeconds > 0 ? resetSeconds : 0);

    if (bucket.tokens < 1) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Rate limit of ${limitPerMinute} req/min exceeded. Please retry in ${resetSeconds}s.`,
          details: {
            limit: limitPerMinute,
            retryAfterSeconds: resetSeconds
          }
        }
      });
      return;
    }

    // Consume 1 token
    bucket.tokens -= 1;
    next();
  };
}
