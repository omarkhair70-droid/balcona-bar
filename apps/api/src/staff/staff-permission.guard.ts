import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  REQUIRED_PERMISSION_KEY,
  RequiredPermissionMetadata,
} from './required-permission.decorator';
import { StaffAccessService } from './staff-access.service';

interface StaffPermissionRequest extends Request {
  staffUser?: {
    id?: string;
  };
}

@Injectable()
export class StaffPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staffAccessService: StaffAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<RequiredPermissionMetadata>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<StaffPermissionRequest>();
    const staffUserId = request.staffUser?.id;

    if (!staffUserId) {
      throw new ForbiddenException('Staff user context is required');
    }

    await this.staffAccessService.assertCan(staffUserId, metadata.permission, {
      companyId: metadata.companyIdParam
        ? request.params[metadata.companyIdParam]
        : undefined,
      branchId: metadata.branchIdParam
        ? request.params[metadata.branchIdParam]
        : undefined,
    });

    return true;
  }
}
