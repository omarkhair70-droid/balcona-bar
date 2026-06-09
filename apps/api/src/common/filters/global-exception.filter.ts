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
  code?: string;
  message?: string;
  statusCode?: number;
  details?: unknown;
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
        code: payload.code ?? payload.error ?? HttpStatus[status] ?? 'Error',
        message: payload.message ?? 'Internal server error',
        statusCode: status,
        path: requestPath,
        method: request.method,
        requestId,
        timestamp: new Date().toISOString(),
        ...(payload.details ? { details: payload.details } : {}),
      },
    });
  }

  private normalizePayload(exceptionResponse: unknown): ErrorPayload {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const payload = exceptionResponse as Record<string, unknown>;
      const code = this.messageFromValue(payload.code);
      const message = this.messageFromValue(payload.message);

      return {
        error: this.messageFromValue(payload.error),
        code,
        message,
        statusCode:
          typeof payload.statusCode === 'number'
            ? payload.statusCode
            : undefined,
        details: this.safeBusinessDetails(payload.details, code, message),
      };
    }

    return {};
  }

  private safeBusinessDetails(
    details: unknown,
    code: string | undefined,
    message: string | undefined,
  ) {
    if (!details || !this.canExposeDetails(code, message)) {
      return undefined;
    }

    return this.sanitizeJson(details);
  }

  private canExposeDetails(
    code: string | undefined,
    message: string | undefined,
  ) {
    return (
      code === 'kds_routing_failed' ||
      code === 'item_out_of_stock' ||
      message === 'Item is out of stock'
    );
  }

  private sanitizeJson(value: unknown, depth = 0): unknown {
    if (depth > 4) {
      return undefined;
    }

    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();

      return normalized ? this.redactSensitiveText(normalized) : undefined;
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 25)
        .map((item) => this.sanitizeJson(item, depth + 1))
        .filter((item) => item !== undefined);
    }

    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value).slice(0, 30)) {
      if (this.isSensitiveKey(key)) {
        continue;
      }

      const sanitizedValue = this.sanitizeJson(entryValue, depth + 1);

      if (sanitizedValue !== undefined) {
        sanitized[key] = sanitizedValue;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private isSensitiveKey(key: string) {
    return /password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|env|connection|string|url/i.test(
      key,
    );
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
      const message =
        exception.message.trim() || exception.name || 'Unexpected exception';

      return {
        name: exception.name,
        message: this.redactSensitiveText(message),
        code: this.stringProperty(exception, 'code'),
        stackFirstLine: this.stackFirstLine(exception.stack),
      };
    }

    if (typeof exception === 'string') {
      return {
        message: this.redactSensitiveText(
          exception.trim() || 'Non-error exception',
        ),
      };
    }

    if (exception && typeof exception === 'object') {
      const message =
        this.messageFromValue(exception) ??
        this.stringProperty(exception, 'name') ??
        'Non-error exception';

      return {
        type: exception.constructor?.name ?? 'object',
        message: this.redactSensitiveText(message),
        code: this.stringProperty(exception, 'code'),
      };
    }

    return { type: typeof exception, message: 'Non-error exception' };
  }

  private stackFirstLine(stack: string | undefined) {
    if (!stack) {
      return undefined;
    }

    return this.redactSensitiveText(stack.split('\n')[0]?.trim() ?? '');
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
