import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { TableSessionAccessService } from "../table-session-access.service";

export interface CustomerSessionAccessRequest extends Request {
  customerSessionIdentity?: {
    id: string;
    tableSessionId: string;
    companyId: string;
    branchId: string;
  };
}

@Injectable()
export class CustomerSessionAccessGuard implements CanActivate {
  constructor(
    private readonly tableSessionAccessService: TableSessionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<CustomerSessionAccessRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException(
        "Customer table session bearer token is required",
      );
    }

    const sessionId =
      typeof request.params?.sessionId === "string"
        ? request.params.sessionId
        : undefined;

    if (!sessionId) {
      throw new UnauthorizedException(
        "Customer table session context is required",
      );
    }

    const identity = await this.tableSessionAccessService.validateAccessToken(
      token,
      sessionId,
    );

    request.customerSessionIdentity = {
      id: identity.id,
      tableSessionId: sessionId,
      companyId: identity.companyId,
      branchId: identity.branchId,
    };

    return true;
  }

  private extractBearerToken(request: Request) {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token, ...extra] = authorization.trim().split(/\s+/);

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !token ||
      extra.length > 0
    ) {
      return null;
    }

    return token;
  }
}
