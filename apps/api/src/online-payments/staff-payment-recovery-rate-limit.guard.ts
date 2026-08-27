import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Response } from "express";
import { StaffAuthRequest } from "../staff-auth/guards/staff-session.guard";
import { PaymentRateLimitService } from "./payment-rate-limit.service";

@Injectable()
export class StaffPaymentRecoveryRateLimitGuard implements CanActivate {
  constructor(
    private readonly paymentRateLimitService: PaymentRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<StaffAuthRequest>();
    const response = http.getResponse<Response>();
    const staffUserId = request.staffUser?.id;

    if (!staffUserId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          code: "staff_payment_access_required",
          message: "Staff payment access must be verified first.",
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const result = await this.paymentRateLimitService.consume(
      "staff_recover",
      staffUserId,
      "provider-recovery",
    );

    response.setHeader("RateLimit-Limit", String(result.limit));
    response.setHeader("RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      response.setHeader("Retry-After", String(result.retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: "payment_recovery_rate_limit_exceeded",
          message:
            "Too many payment recovery requests. Try again shortly.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
