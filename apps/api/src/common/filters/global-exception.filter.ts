import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorPayload {
  error?: string;
  message?: string;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : undefined;
    const payload = this.normalizePayload(exceptionResponse);
    const requestPath = this.safeRequestPath(request);
    const requestId = this.getRequestId(request, response);

    if (!isHttpException) {
      this.logger.error({
        message: 'Unhandled API exception',
        requestId,
        method: request.method,
        path: requestPath,
        statusCode: status,
        exception: this.safeExceptionSummary(exception),
      });
    }

    response.status(status).json({
      success: false,
      error: {
        code: payload.error ?? HttpStatus[status] ?? 'Error',
        message: payload.message ?? 'Internal server error',
        statusCode: status,
        path: requestPath,
        method: request.method,
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private normalizePayload(exceptionResponse: unknown): ErrorPayload {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as Record<string, unknown>;

      return {
        error: this.messageFromValue(payload.error),
        message: this.messageFromValue(payload.message),
        statusCode:
          typeof payload.statusCode === 'number'
            ? payload.statusCode
            : undefined,
      };
    }

    return {};
  }

  private messageFromValue(value: unknown, depth = 0): string | undefined {
    if (depth > 4) {
      return undefined;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();

      return normalized && normalized !== '[object Object]'
        ? normalized
        : undefined;
    }

    if (Array.isArray(value)) {
      const messages = value
        .map((item) => this.messageFromValue(item, depth + 1))
        .filter((message): message is string => Boolean(message));

      return messages.length > 0 ? messages.join(', ') : undefined;
    }

    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;

    return (
      this.messageFromValue(record.message, depth + 1) ??
      this.messageFromValue(record.details, depth + 1) ??
      this.messageFromValue(record.error, depth + 1) ??
      this.messageFromValue(record.response, depth + 1)
    );
  }

  private safeRequestPath(request: Request) {
    return request.path || request.url.split('?')[0] || request.url;
  }

  private getRequestId(request: Request, response: Response) {
    const requestHeader = request.header('x-request-id')?.trim();
    const responseHeader = response.getHeader('x-request-id');

    return (
      requestHeader ||
      (typeof responseHeader === 'string' ? responseHeader : undefined)
    );
  }

  private safeExceptionSummary(exception: unknown) {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: this.redactSensitiveText(exception.message),
        code: this.stringProperty(exception, 'code'),
      };
    }

    if (typeof exception === 'string') {
      return { message: this.redactSensitiveText(exception) };
    }

    return { type: typeof exception };
  }

  private stringProperty(value: object, key: string) {
    const property = (value as Record<string, unknown>)[key];

    return typeof property === 'string'
      ? this.redactSensitiveText(property)
      : undefined;
  }

  private redactSensitiveText(value: string) {
    const redacted = value
      .replace(
        /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie)(\s*[:=]\s*)([^,\s}]+)/gi,
        '$1$2[redacted]',
      )
      .replace(
        /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
        '$1[redacted]$3',
      );

    return redacted.length > 1_000
      ? `${redacted.slice(0, 1_000)}...`
      : redacted;
  }
}
