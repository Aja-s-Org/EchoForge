import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
  };
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);
  
  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Check for API key in Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      this.logger.warn(`Unauthorized access attempt to ${req.method} ${req.path} from IP: ${req.ip}`);
      res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please provide an API key.',
      });
      return;
    }
    
    // Expecting "Bearer <api-key>" or "ApiKey <api-key>" format
    const [scheme, token] = authHeader.split(' ');
    
    if (!scheme || !token) {
      this.logger.warn(`Invalid auth header format for ${req.method} ${req.path}`);
      res.status(401).json({
        status: 'error',
        message: 'Invalid authorization header format. Expected: "Bearer <api-key>" or "ApiKey <api-key>"',
      });
      return;
    }
    
    // Validate the API key
    const isValid = this.validateApiKey(token);
    
    if (!isValid) {
      this.logger.warn(`Invalid API key attempt for ${req.method} ${req.path}`);
      res.status(401).json({
        status: 'error',
        message: 'Invalid API key',
      });
      return;
    }
    
    // Extract user information from token (in a real app, decode JWT or query database)
    const userInfo = this.extractUserInfo(token);
    
    // Attach user information to request
    req.user = userInfo;
    
    this.logger.debug(`Authenticated request from user ${userInfo.id} to ${req.method} ${req.path}`);
    next();
  }
  
  private validateApiKey(apiKey: string): boolean {
    // In a real implementation, this would:
    // 1. Check against database of valid API keys
    // 2. Validate JWT tokens
    // 3. Check token expiration
    
    // For now, accept any non-empty API key that starts with "sk_" or "ek_"
    // This simulates the pattern used by many API services
    
    return (
      apiKey.length > 10 && 
      (apiKey.startsWith('sk_') || apiKey.startsWith('ek_') || apiKey.startsWith('vc_'))
    );
  }
  
  private extractUserInfo(apiKey: string): { id: string; email?: string; roles?: string[]; permissions?: string[] } {
    // In a real implementation, this would:
    // 1. Decode JWT token
    // 2. Query user database
    // 3. Extract permissions/roles
    
    // For now, create a mock user based on API key prefix
    if (apiKey.startsWith('sk_')) {
      return {
        id: `service_${apiKey.substring(3, 13)}`,
        roles: ['service'],
        permissions: ['voice.clone', 'voice.read', 'voice.list'],
      };
    } else if (apiKey.startsWith('ek_')) {
      return {
        id: `external_${apiKey.substring(3, 13)}`,
        roles: ['external'],
        permissions: ['voice.clone', 'voice.read'],
      };
    } else {
      return {
        id: `voice_${apiKey.substring(3, 13)}`,
        roles: ['voice_user'],
        permissions: ['voice.clone'],
      };
    }
  }
}

// Decorator for requiring specific roles
export function RequireRoles(...roles: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0] as AuthenticatedRequest;
      
      if (!req.user) {
        throw new Error('User not authenticated');
      }
      
      const userRoles = req.user.roles || [];
      const hasRequiredRole = roles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        const logger = new Logger(target.constructor.name);
        logger.warn(`User ${req.user.id} attempted to access ${propertyKey} without required roles: ${roles.join(', ')}`);
        
        throw new Error(`Insufficient permissions. Required roles: ${roles.join(', ')}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// Decorator for requiring specific permissions
export function RequirePermissions(...permissions: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0] as AuthenticatedRequest;
      
      if (!req.user) {
        throw new Error('User not authenticated');
      }
      
      const userPermissions = req.user.permissions || [];
      const hasRequiredPermission = permissions.every(permission => userPermissions.includes(permission));
      
      if (!hasRequiredPermission) {
        const logger = new Logger(target.constructor.name);
        logger.warn(`User ${req.user.id} attempted to access ${propertyKey} without required permissions: ${permissions.join(', ')}`);
        
        throw new Error(`Insufficient permissions. Required: ${permissions.join(', ')}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// Simple guard for use in controllers
export class AuthGuard {
  private readonly logger = new Logger(AuthGuard.name);
  
  canActivate(context: any): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    
    if (!request.user) {
      this.logger.warn(`Unauthorized access attempt to ${request.method} ${request.path}`);
      return false;
    }
    
    return true;
  }
}

export function UseAuth() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const guard = new AuthGuard();
    
    descriptor.value = async function (...args: any[]) {
      const context = {
        switchToHttp: () => ({
          getRequest: () => args[0],
        }),
      };
      
      if (!guard.canActivate(context)) {
        throw new Error('Authentication required');
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}