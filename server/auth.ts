import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { Database } from './db.ts';
import type { ApiKeyRecord, User } from './types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'busternodes_dvm_panel_secret_jwt_key_2026';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyRecord;
      user?: User;
      authMethod?: 'api_key' | 'panel_session';
    }
  }
}

export function createJwtToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyJwtToken(token: string): { userId: string; email: string; role: 'admin' | 'user' } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'This operation requires administrator privileges'
      }
    });
    return;
  }
  next();
}

export function generateSecureAdminApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  // Format: dvm_admin_<48 hex chars>
  const random = crypto.randomBytes(24).toString('hex');
  const fullKey = `dvm_admin_${random}`;
  const keyPrefix = `dvm_admin_${random.slice(0, 6)}...${random.slice(-4)}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return { fullKey, keyPrefix, keyHash };
}

export function generateSecureApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  // Format: dvm_live_<32 hex chars>
  const random = crypto.randomBytes(24).toString('hex');
  const fullKey = `dvm_live_${random}`;
  const keyPrefix = `dvm_live_${random.slice(0, 6)}...${random.slice(-4)}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return { fullKey, keyPrefix, keyHash };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

/**
 * Middleware: Enforces valid API Bearer token for /api/v1 external endpoints.
 * Prioritizes the Single Master Admin API Key for bot and external automation.
 * Also supports transparent session for the panel frontend (using internal session or default admin).
 */
export function authenticateApiKey(options: { allowSessionFallback?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/dvm_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]).trim();
    } else if (typeof req.query.token === 'string') {
      token = req.query.token.trim();
    }

    if (token) {
      // 1. Check if token is a valid JWT session for logged-in users/admins
      const jwtPayload = verifyJwtToken(token);
      if (jwtPayload && jwtPayload.userId) {
        const user = Database.getUserById(jwtPayload.userId);
        if (user) {
          if (user.status === 'suspended') {
            res.status(403).json({
              success: false,
              error: {
                code: 'ACCOUNT_SUSPENDED',
                message: 'Your account has been suspended by an administrator'
              }
            });
            return;
          }
          req.user = user;
          req.authMethod = 'panel_session';
          next();
          return;
        }
      }

      // 2. Check if token is the Single Master Admin API Key
      const hash = hashApiKey(token);
      const adminKey = Database.getAdminApiKey();
      if (adminKey && adminKey.key_hash === hash) {
        if (adminKey.status === 'revoked') {
          res.status(401).json({
            success: false,
            error: {
              code: 'KEY_REVOKED',
              message: 'The BusterNodes Admin API key is revoked. API access is disabled.'
            }
          });
          return;
        }

        Database.updateAdminApiKeyLastUsed();
        const adminUser = Database.getDefaultAdmin();
        req.user = adminUser;
        req.authMethod = 'api_key';
        req.apiKey = {
          id: 'admin_master_key',
          user_id: adminUser.id,
          name: 'BusterNodes Master Admin Key',
          key_prefix: adminKey.key_prefix,
          key_hash: adminKey.key_hash,
          permissions: [
            'vms.read', 'vms.create', 'vms.start', 'vms.stop', 'vms.restart', 'vms.delete',
            'images.read', 'usage.read', 'api.keys.read', 'api.keys.manage'
          ],
          created_at: adminKey.created_at,
          expires_at: null,
          last_used_at: adminKey.last_used_at,
          is_revoked: 0,
          revoked_at: null,
          description: 'Single Master Admin API Key for BusterNodes DVM Panel'
        };
        next();
        return;
      }

      // 3. Check legacy multi-key table if applicable
      const keyRecord = Database.getApiKeyByHash(hash);
      if (keyRecord) {
        if (keyRecord.is_revoked) {
          res.status(401).json({
            success: false,
            error: {
              code: 'KEY_REVOKED',
              message: 'This API key has been revoked and cannot be used'
            }
          });
          return;
        }

        if (keyRecord.expires_at) {
          const expiryTime = new Date(keyRecord.expires_at).getTime();
          if (expiryTime <= Date.now()) {
            res.status(401).json({
              success: false,
              error: {
                code: 'KEY_EXPIRED',
                message: 'This API key expired on ' + keyRecord.expires_at
              }
            });
            return;
          }
        }

        const user = Database.getUserById(keyRecord.user_id);
        if (!user) {
          res.status(401).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'Associated user account could not be found'
            }
          });
          return;
        }

        Database.updateKeyLastUsed(keyRecord.id);
        req.apiKey = keyRecord;
        req.user = user;
        req.authMethod = 'api_key';
        next();
        return;
      }

      // Invalid token provided
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid or expired session token or API key'
        }
      });
      return;
    }

    // Fallback for tests/internal endpoints only if explicitly opted-in
    if (options.allowSessionFallback) {
      const admin = Database.getDefaultAdmin();
      req.user = admin;
      req.authMethod = 'panel_session';
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in or provide an Authorization Bearer token.'
      }
    });
  };
}
