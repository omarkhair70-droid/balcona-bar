import { Logger } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import {
  attachCorrelationHeaders,
  createCorrelationContext,
  extractSafeIds,
  getCorrelationContext,
  inferActionFromRequest,
  resultFromStatus,
  safeExceptionSummary,
  safeRequestPath,
  setRequestCorrelation,
} from "../observability/observability.util";

const logger = new Logger("ApiRequest");
const SLOW_REQUEST_THRESHOLD_MS = 2_000;

export type RequestObservabilityOptions = {
  environment?: string;
};

function responseErrorCode(response: Response) {
  const locals = response.locals as {
    operationalErrorCode?: string;
    errorCode?: string;
    prismaCode?: string;
  };

  return locals.operationalErrorCode ?? locals.errorCode;
}

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const correlation = createCorrelationContext(request);

  setRequestCorrelation(request, response, correlation);
  next();
}

export function requestObservabilityMiddleware(
  options: RequestObservabilityOptions = {},
) {
  return (request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const correlation = getCorrelationContext(request, response);
    const path = safeRequestPath(request);
    const action = inferActionFromRequest(request.method, path);
    const baseLog = {
      ...correlation,
      method: request.method,
      path,
      action,
      environment:
        options.environment ?? process.env.APP_ENV ?? process.env.NODE_ENV,
      ...extractSafeIds(request),
    };

    attachCorrelationHeaders(response, correlation);

    logger.log({
      message: "request_started",
      stage: "request",
      result: "started",
      ...baseLog,
    });

    response.once("finish", () => {
      const durationMs = Date.now() - startedAt;
      const statusCode = response.statusCode;
      const result = resultFromStatus(statusCode);
      const errorCode = responseErrorCode(response);
      const completedLog = {
        message: result === "failure" ? "request_failed" : "request_completed",
        stage: "request",
        result,
        ...baseLog,
        statusCode,
        durationMs,
        ...(errorCode ? { errorCode } : {}),
        ...(response.locals.prismaCode
          ? { prismaCode: response.locals.prismaCode }
          : {}),
      };

      if (result === "failure") {
        logger.warn(completedLog);
      } else {
        logger.log(completedLog);
      }

      if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
        logger.warn({
          message: "slow_request",
          stage: "request",
          result,
          ...baseLog,
          statusCode,
          durationMs,
          thresholdMs: SLOW_REQUEST_THRESHOLD_MS,
          ...(errorCode ? { errorCode } : {}),
        });
      }
    });

    response.once("error", (error) => {
      logger.error({
        message: "request_failed",
        stage: "response_stream",
        result: "failure",
        ...baseLog,
        durationMs: Date.now() - startedAt,
        exception: safeExceptionSummary(error),
      });
    });

    next();
  };
}
