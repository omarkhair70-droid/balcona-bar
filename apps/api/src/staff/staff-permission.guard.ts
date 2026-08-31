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
      throw new ForbiddenException({
        code: 'staff_user_context_required',
        message: 'Staff user context is required',
      });
    }

    await this.staffAccessService.assertCan(staffUserId, metadata.permission, {
      companyId: metadata.companyIdParam
        ? this.getSingleParam(request.params[metadata.companyIdParam])
        : undefined,
      branchId: metadata.branchIdParam
        ? this.getSingleParam(request.params[metadata.branchIdParam])
        : metadata.branchIdQuery
          ? this.getSingleQuery(request.query[metadata.branchIdQuery])
          : undefined,
    });

    return true;
  }

  private getSingleParam(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private getSingleQuery(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return undefined;
  }
}
