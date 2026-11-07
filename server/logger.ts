import type { Request, Response, NextFunction } from 'express';
import { Database } from './db.ts';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Intercept response finish
  res.on('finish', () => {
    // Only log API endpoints (/api/v1/*)
    if (!req.originalUrl.startsWith('/api/v1')) {
      return;
    }

    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';

    // Mask sensitive routes or errors
    let errorCode: string | null = null;
    if (statusCode >= 400) {
      if (statusCode === 401) errorCode = 'UNAUTHORIZED';
      else if (statusCode === 403) errorCode = 'FORBIDDEN';
      else if (statusCode === 404) errorCode = 'NOT_FOUND';
      else if (statusCode === 429) errorCode = 'RATE_LIMIT_EXCEEDED';
      else if (statusCode >= 500) errorCode = 'INTERNAL_ERROR';
      else errorCode = 'BAD_REQUEST';
    }

    try {
      Database.logApiRequest({
        api_key_id: req.apiKey?.id || null,
        key_prefix: req.apiKey?.key_prefix || (req.authMethod === 'panel_session' ? 'session:admin' : null),
        user_id: req.user?.id || null,
        endpoint: req.baseUrl + req.path,
        method: req.method,
        status_code: statusCode,
        duration_ms: duration,
        ip_address: ip,
        error_code: errorCode,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Avoid throwing in response hook
      console.error('Failed to log API request:', err);
    }
  });

  next();
}
