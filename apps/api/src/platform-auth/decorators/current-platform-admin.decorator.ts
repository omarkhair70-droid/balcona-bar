import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { PlatformAuthRequest } from "../guards/platform-session.guard";

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<PlatformAuthRequest>();

    return {
      platformAdminUser: request.platformAdminUser,
      platformAdminSession: request.platformAdminSession,
    };
  },
);
