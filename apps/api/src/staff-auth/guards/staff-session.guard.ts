import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthContext } from '../staff-auth.types';
import { StaffAuthService } from '../staff-auth.service';

export interface StaffAuthRequest extends Request {
  staffUser?: StaffAuthContext['staffUser'];
  staffSession?: StaffAuthContext['staffSession'];
  staffAccess?: StaffAuthContext['effectiveAccess'];
}

@Injectable()
export class StaffSessionGuard implements CanActivate {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Staff bearer token is required');
    }

    const authContext = await this.staffAuthService.validateToken(token);
    request.staffUser = authContext.staffUser;
    request.staffSession = authContext.staffSession;
    request.staffAccess = authContext.effectiveAccess;

    return true;
  }

  private extractBearerToken(request: Request) {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}

