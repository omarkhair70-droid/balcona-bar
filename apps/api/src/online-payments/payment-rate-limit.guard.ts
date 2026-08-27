import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Response } from "express";
import { CustomerSessionAccessRequest } from "../table-sessions/guards/customer-session-access.guard";
import {
  PAYMENT_RATE_LIMIT_POLICY,
  PaymentRateLimitPolicy,
} from "./payment-rate-limit.decorator";
import { PaymentRateLimitService } from "./payment-rate-limit.service";

@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly paymentRateLimitService: PaymentRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<
      PaymentRateLimitPolicy | undefined
    >(PAYMENT_RATE_LIMIT_POLICY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!policy) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<CustomerSessionAccessRequest>();
    const response = http.getResponse<Response>();
    const identity = request.customerSessionIdentity;
    const sessionId =
      typeof request.params?.sessionId === "string"
        ? request.params.sessionId
        : undefined;

    if (!identity || !sessionId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          code: "customer_payment_access_required",
          message: "Customer payment access must be verified first.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const result = await this.paymentRateLimitService.consume(
      policy,
      identity.id,
      sessionId,
    );

    response.setHeader("RateLimit-Limit", String(result.limit));
    response.setHeader("RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      response.setHeader("Retry-After", String(result.retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: "payment_rate_limit_exceeded",
          message: "Too many online payment requests. Try again shortly.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
