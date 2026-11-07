import type { Request, Response, NextFunction } from 'express';
import type { ApiPermission } from './types.ts';

export function requirePermission(permission: ApiPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Panel session users and admins have full access to manage resources
    if (req.authMethod === 'panel_session' || req.user?.role === 'admin') {
      next();
      return;
    }

    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking permissions'
        }
      });
      return;
    }

    const hasPerm = req.apiKey.permissions.includes(permission);
    if (!hasPerm) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `API key lacks the required permission: '${permission}'`,
          details: {
            requiredPermission: permission,
            assignedPermissions: req.apiKey.permissions
          }
        }
      });
      return;
    }

    next();
  };
}
