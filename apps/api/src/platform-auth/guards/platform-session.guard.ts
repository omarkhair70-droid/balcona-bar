import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { PlatformAuthContext } from "../platform-auth.types";
import { PlatformAuthService } from "../platform-auth.service";

export interface PlatformAuthRequest extends Request {
  platformAdminUser?: PlatformAuthContext["platformAdminUser"];
  platformAdminSession?: PlatformAuthContext["platformAdminSession"];
}

@Injectable()
export class PlatformSessionGuard implements CanActivate {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformAuthRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Platform bearer token is required");
    }

    const authContext = await this.platformAuthService.validateToken(token);
    request.platformAdminUser = authContext.platformAdminUser;
    request.platformAdminSession = authContext.platformAdminSession;

    return true;
  }

  private extractBearerToken(request: Request) {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }
}
