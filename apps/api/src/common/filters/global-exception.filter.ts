import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  getCorrelationContext,
  messageFromValue,
  operationalCodeFromException,
  prismaCodeFromException,
  safeExceptionSummary,
  safeRequestPath,
  sanitizeJson,
  stringProperty,
} from "../observability/observability.util";

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

  constructor(
    private readonly environment = process.env.APP_ENV ?? process.env.NODE_ENV,
  ) {}

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
    const requestPath = safeRequestPath(request);
    const correlation = getCorrelationContext(request, response);
    const prismaCode = prismaCodeFromException(exception);
    const operationalCode =
      payload.code ?? operationalCodeFromException(exception, status);
    const exceptionSummary = safeExceptionSummary(exception);

    response.locals = response.locals ?? {};
    response.locals.errorCode = payload.code;
    response.locals.operationalErrorCode = operationalCode;
    response.locals.prismaCode = prismaCode;

    if (!isHttpException) {
      this.logger.error({
        message: "Unhandled API exception",
        ...correlation,
        method: request.method,
        path: requestPath,
        statusCode: status,
        operationalCode,
        prismaCode,
        exception: exceptionSummary,
      });
    }

    const stagingDebug = this.stagingDebugFields(
      exception,
      payload.details,
      operationalCode,
    );

    response.status(status).json({
      success: false,
      error: {
        code:
          operationalCode ??
          payload.error ??
          HttpStatus[status] ??
          "UNKNOWN_OPERATIONAL_ERROR",
        message:
          isHttpException && payload.message
            ? payload.message
            : this.publicMessageForOperationalCode(operationalCode),
        statusCode: status,
        path: requestPath,
        method: request.method,
        requestId: correlation.requestId,
        flowId: correlation.flowId,
        clientTraceId: correlation.clientTraceId,
        timestamp: new Date().toISOString(),
        ...(payload.details ? { details: payload.details } : {}),
        ...stagingDebug,
      },
    });
  }

  private normalizePayload(exceptionResponse: unknown): ErrorPayload {
    if (typeof exceptionResponse === "string") {
      return { message: exceptionResponse };
    }

    if (exceptionResponse && typeof exceptionResponse === "object") {
      const payload = exceptionResponse as Record<string, unknown>;
      const code = messageFromValue(payload.code) || undefined;
      const message = messageFromValue(payload.message) || undefined;

      return {
        error: messageFromValue(payload.error) || undefined,
        code,
        message,
        statusCode:
          typeof payload.statusCode === "number"
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

    return sanitizeJson(details);
  }

  private canExposeDetails(
    code: string | undefined,
    message: string | undefined,
  ) {
    return (
      code === "kds_routing_failed" ||
      code === "KDS_ROUTING_FAILED" ||
      code === "DB_TRANSACTION_TIMEOUT" ||
      code === "item_out_of_stock" ||
      message === "Item is out of stock"
    );
  }

  private stagingDebugFields(
    exception: unknown,
    details: unknown,
    operationalCode: string | undefined,
  ) {
    if (this.environment !== "staging" && this.environment !== "development") {
      return {};
    }

    const exceptionSummary = safeExceptionSummary(exception);
    const detailsRecord =
      details && typeof details === "object" && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : {};

    return {
      operationalCode,
      exceptionName: exceptionSummary.name,
      sanitizedExceptionMessage: exceptionSummary.message,
      prismaCode: exceptionSummary.prismaCode,
      failureStage:
        stringProperty(detailsRecord, "failureStage") ??
        stringProperty(detailsRecord, "stage"),
      substage: stringProperty(detailsRecord, "substage"),
      action: stringProperty(detailsRecord, "action"),
      flow: stringProperty(detailsRecord, "flow"),
    };
  }

  private publicMessageForOperationalCode(code: string | undefined) {
    switch (code) {
      case "DB_TRANSACTION_TIMEOUT":
        return "The operation timed out while saving. Please retry.";
      case "DATABASE_SCHEMA_MISMATCH":
      case "MIGRATION_NOT_APPLIED":
        return "The API database schema is not ready for this operation.";
      case "UNKNOWN_OPERATIONAL_ERROR":
      default:
        return "Internal server error";
    }
  }
}
