import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const existingRequestId = request.header('x-request-id');
  const requestId = existingRequestId?.trim() || randomUUID();

  response.setHeader('x-request-id', requestId);
  next();
}

