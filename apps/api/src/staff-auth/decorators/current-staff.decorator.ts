import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StaffAuthRequest } from '../guards/staff-session.guard';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();

    return {
      staffUser: request.staffUser,
      staffSession: request.staffSession,
      staffAccess: request.staffAccess,
    };
  },
);

