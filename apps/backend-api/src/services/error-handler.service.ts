import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MetricsService } from './metrics.service';

export interface ErrorDetails {
  errorCode: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  errorCode?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ErrorCategory {
  category: string;
  description: string;
  examples: string[];
  handlingStrategy: string;
  httpStatus: HttpStatus;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);
  private readonly errorCategories: ErrorCategory[] = [
    {
      category: 'VALIDATION_ERROR',
      description: 'Input validation failed',
      examples: ['Invalid file format', 'Missing required field', 'Invalid parameter value'],
      handlingStrategy: 'Return 400 Bad Request with specific validation errors',
      httpStatus: HttpStatus.BAD_REQUEST,
    },
    {
      category: 'AUTHENTICATION_ERROR',
      description: 'Authentication or authorization failed',
      examples: ['Invalid API key', 'Missing authentication token', 'Insufficient permissions'],
      handlingStrategy: 'Return 401 Unauthorized or 403 Forbidden',
      httpStatus: HttpStatus.UNAUTHORIZED,
    },
    {
      category: 'RATE_LIMIT_ERROR',
      description: 'Rate limit exceeded',
      examples: ['Too many requests', 'Rate limit exceeded'],
      handlingStrategy: 'Return 429 Too Many Requests with retry-after header',
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    },
    {
      category: 'RESOURCE_ERROR',
      description: 'Resource not found or unavailable',
      examples: ['File not found', 'Job not found', 'Storage service unavailable'],
      handlingStrategy: 'Return 404 Not Found or 503 Service Unavailable',
      httpStatus: HttpStatus.NOT_FOUND,
    },
    {
      category: 'PROCESSING_ERROR',
      description: 'Voice processing failed',
      examples: ['Audio processing failed', 'Model inference error', 'Memory allocation failed'],
      handlingStrategy: 'Return 500 Internal Server Error with job failure details',
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    },
    {
      category: 'CONFIGURATION_ERROR',
      description: 'Configuration or initialization error',
      examples: ['Invalid configuration', 'Missing environment variables', 'Service initialization failed'],
      handlingStrategy: 'Return 500 Internal Server Error, log and alert',
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    },
    {
      category: 'INTEGRATION_ERROR',
      description: 'External service integration failed',
      examples: ['Storage service error', 'Database connection failed', 'External API failure'],
      handlingStrategy: 'Return 502 Bad Gateway or 503 Service Unavailable',
      httpStatus: HttpStatus.BAD_GATEWAY,
    },
  ];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  handleError(error: unknown, context?: Record<string, any>): ErrorResponse {
    const errorDetails = this.extractErrorDetails(error, context);
    const category = this.categorizeError(errorDetails);
    
    // Log the error
    this.logError(errorDetails, category);
    
    // Record metrics
    this.recordErrorMetrics(errorDetails, category);
    
    // Create user-friendly response
    return this.createErrorResponse(errorDetails, category);
  }

  createHttpException(error: unknown, context?: Record<string, any>): HttpException {
    const errorResponse = this.handleError(error, context);
    const category = this.categorizeError(this.extractErrorDetails(error, context));
    
    return new HttpException(
      {
        status: errorResponse.status,
        message: errorResponse.message,
        errorCode: errorResponse.errorCode,
        details: errorResponse.details,
        timestamp: errorResponse.timestamp,
      },
      category.httpStatus,
    );
  }

  handleJobError(jobId: string, error: unknown, context?: Record<string, any>): void {
    const errorDetails = this.extractErrorDetails(error, { ...context, jobId });
    const category = this.categorizeError(errorDetails);
    
    // Log the error
    this.logger.error(`Job ${jobId} failed: ${errorDetails.message}`, errorDetails.stack);
    
    // Update job status in database
    this.updateJobWithError(jobId, errorDetails, category).catch(err => {
      this.logger.error(`Failed to update job ${jobId} with error`, err);
    });
    
    // Record metrics
    this.recordErrorMetrics(errorDetails, category);
  }

  async getErrorStats(fromDate?: Date): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: ErrorDetails[];
  }> {
    const operations = await this.databaseService.getOperationMetrics({
      fromDate,
    });

    const errorOperations = operations.filter(op => !op.success);
    const recentErrors: ErrorDetails[] = [];

    for (const op of errorOperations) {
      recentErrors.push({
        errorCode: 'OPERATION_FAILED',
        message: `Operation ${op.operation} failed`,
        context: op.details,
        timestamp: op.timestamp,
        severity: this.determineSeverityFromOperation(op),
      });
    }

    const errorsByCategory: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    for (const error of recentErrors) {
      const category = this.categorizeError(error);
      errorsByCategory[category.category] = (errorsByCategory[category.category] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }

    return {
      totalErrors: errorOperations.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
    };
  }

  getErrorCategories(): ErrorCategory[] {
    return [...this.errorCategories];
  }

  private extractErrorDetails(error: unknown, context?: Record<string, any>): ErrorDetails {
    if (error instanceof Error) {
      return {
        errorCode: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date(),
        severity: this.determineSeverity(error),
      };
    } else if (typeof error === 'string') {
      return {
        errorCode: 'STRING_ERROR',
        message: error,
        context,
        timestamp: new Date(),
        severity: 'medium',
      };
    } else {
      return {
        errorCode: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        context,
        timestamp: new Date(),
        severity: 'high',
      };
    }
  }

  private categorizeError(errorDetails: ErrorDetails): ErrorCategory {
    const message = errorDetails.message.toLowerCase();
    
    // Check for authentication errors
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('permission') ||
      message.includes('api key') ||
      message.includes('token')
    ) {
      return this.errorCategories.find(c => c.category === 'AUTHENTICATION_ERROR')!;
    }
    
    // Check for validation errors
    if (
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('missing') ||
      message.includes('required') ||
      message.includes('format')
    ) {
      return this.errorCategories.find(c => c.category === 'VALIDATION_ERROR')!;
    }
    
    // Check for rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('throttle')
    ) {
      return this.errorCategories.find(c => c.category === 'RATE_LIMIT_ERROR')!;
    }
    
    // Check for resource errors
    if (
      message.includes('not found') ||
      message.includes('unavailable') ||
      message.includes('missing') ||
      message.includes('does not exist')
    ) {
      return this.errorCategories.find(c => c.category === 'RESOURCE_ERROR')!;
    }
    
    // Check for processing errors
    if (
      message.includes('process') ||
      message.includes('audio') ||
      message.includes('model') ||
      message.includes('memory') ||
      message.includes('inference')
    ) {
      return this.errorCategories.find(c => c.category === 'PROCESSING_ERROR')!;
    }
    
    // Check for configuration errors
    if (
      message.includes('config') ||
      message.includes('environment') ||
      message.includes('initialize') ||
      message.includes('setup')
    ) {
      return this.errorCategories.find(c => c.category === 'CONFIGURATION_ERROR')!;
    }
    
    // Check for integration errors
    if (
      message.includes('storage') ||
      message.includes('database') ||
      message.includes('connection') ||
      message.includes('external') ||
      message.includes('service')
    ) {
      return this.errorCategories.find(c => c.category === 'INTEGRATION_ERROR')!;
    }
    
    // Default to processing error
    return this.errorCategories.find(c => c.category === 'PROCESSING_ERROR')!;
  }

  private determineSeverity(error: Error): ErrorDetails['severity'] {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (
      message.includes('memory') ||
      message.includes('corrupt') ||
      message.includes('security') ||
      message.includes('authentication failed')
    ) {
      return 'critical';
    }
    
    // High severity errors
    if (
      message.includes('database') ||
      message.includes('storage') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return 'high';
    }
    
    // Medium severity errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('processing')
    ) {
      return 'medium';
    }
    
    // Default to low severity
    return 'low';
  }

  private determineSeverityFromOperation(operation: any): ErrorDetails['severity'] {
    if (operation.details?.error) {
      const errorMessage = operation.details.error.toLowerCase();
      
      if (
        errorMessage.includes('memory') ||
        errorMessage.includes('corrupt') ||
        errorMessage.includes('security')
      ) {
        return 'critical';
      }
      
      if (
        errorMessage.includes('database') ||
        errorMessage.includes('storage') ||
        errorMessage.includes('connection')
      ) {
        return 'high';
      }
    }
    
    return 'medium';
  }

  private logError(errorDetails: ErrorDetails, category: ErrorCategory): void {
    const logMessage = `[${category.category}] ${errorDetails.message}`;
    
    switch (errorDetails.severity) {
      case 'critical':
        this.logger.error(logMessage, errorDetails.stack, errorDetails.context);
        break;
      case 'high':
        this.logger.error(logMessage, errorDetails.stack);
        break;
      case 'medium':
        this.logger.warn(logMessage, errorDetails.context);
        break;
      case 'low':
        this.logger.log(logMessage, errorDetails.context);
        break;
    }
  }

  private recordErrorMetrics(errorDetails: ErrorDetails, category: ErrorCategory): void {
    // Record in database
    this.databaseService.recordOperation(
      `error_${category.category.toLowerCase()}`,
      false,
      0,
      {
        errorCode: errorDetails.errorCode,
        message: errorDetails.message,
        severity: errorDetails.severity,
        context: errorDetails.context,
      }
    ).catch(err => {
      this.logger.error('Failed to record error metrics in database', err);
    });
  }

  private createErrorResponse(errorDetails: ErrorDetails, category: ErrorCategory): ErrorResponse {
    // Create user-friendly message based on category
    let userMessage = errorDetails.message;
    
    // Sanitize internal details for user-facing messages
    if (category.category === 'PROCESSING_ERROR' || category.category === 'CONFIGURATION_ERROR') {
      userMessage = 'An internal error occurred while processing your request.';
    } else if (category.category === 'INTEGRATION_ERROR') {
      userMessage = 'A service integration error occurred. Please try again later.';
    }
    
    return {
      status: 'error',
      message: userMessage,
      errorCode: errorDetails.errorCode,
      details: errorDetails.context,
      timestamp: errorDetails.timestamp,
    };
  }

  private async updateJobWithError(jobId: string, errorDetails: ErrorDetails, category: ErrorCategory): Promise<void> {
    await this.databaseService.updateJob(jobId, {
      status: 'failed',
      error: errorDetails.message,
      completedAt: new Date(),
      metadata: {
        errorCategory: category.category,
        errorSeverity: errorDetails.severity,
        errorCode: errorDetails.errorCode,
        failedAt: new Date(),
      },
    });
  }
}