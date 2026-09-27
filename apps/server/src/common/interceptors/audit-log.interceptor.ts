import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OperationLogService } from '../../operation-log/operation-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);
  private readonly methods = new Set(['POST', 'PUT', 'DELETE']);

  constructor(private readonly operationLogService?: OperationLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { userId?: string } }>();
    const method = req?.method?.toUpperCase();

    if (!method || !this.methods.has(method)) {
      return next.handle();
    }

    const start = Date.now();
    const basePayload = {
      method,
      path: req.originalUrl || req.url,
      userId: req.user?.userId || '',
      headers: this.toSafeRecord(req.headers),
      body: this.toSafeJson(req.body),
    };

    this.logger.log(
      JSON.stringify({
        type: 'request_audit',
        stage: 'request',
        ...basePayload,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<{ statusCode?: number }>();
          const statusCode = res?.statusCode || 200;
          const durationMs = Date.now() - start;

          this.persistLog({
            ...basePayload,
            statusCode,
            durationMs,
          });

          this.logger.log(
            JSON.stringify({
              type: 'request_audit',
              stage: 'response',
              ...basePayload,
              statusCode,
              durationMs,
            }),
          );
        },
        error: (error: unknown) => {
          const res = http.getResponse<{ statusCode?: number }>();
          const statusCode = res?.statusCode;
          const durationMs = Date.now() - start;

          this.persistLog({
            ...basePayload,
            statusCode,
            durationMs,
            error: error instanceof Error ? error.message : String(error),
          });

          this.logger.error(
            JSON.stringify({
              type: 'request_audit',
              stage: 'error',
              ...basePayload,
              statusCode,
              durationMs,
              error:
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                    }
                  : String(error),
            }),
          );
        },
      }),
    );
  }

  private persistLog(payload: {
    method: string;
    path: string;
    userId: string;
    headers: Record<string, unknown>;
    body: unknown;
    statusCode?: number;
    durationMs?: number;
    error?: string;
  }) {
    if (!this.operationLogService) {
      return;
    }
    void this.operationLogService.create(payload).catch((err: unknown) => {
      this.logger.warn(
        `persist operation log failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private toSafeJson(value: unknown): unknown {
    if (value === undefined) {
      return null;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    }
  }

  private toSafeRecord(value: unknown): Record<string, unknown> {
    const parsed = this.toSafeJson(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  }
}
