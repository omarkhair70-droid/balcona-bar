import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorPayload {
  error?: string;
  message?: string | string[] | Record<string, unknown>;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload = this.normalizePayload(exceptionResponse);

    response.status(status).json({
      success: false,
      error: {
        code: payload.error ?? HttpStatus[status] ?? 'Error',
        message: payload.message ?? 'Internal server error',
        statusCode: status,
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private normalizePayload(exceptionResponse: unknown): ErrorPayload {
    if (typeof exceptionResponse === 'string') {
      return { message: exceptionResponse };
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      return exceptionResponse as ErrorPayload;
    }

    return {};
  }
}
