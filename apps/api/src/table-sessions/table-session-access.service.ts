import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CustomerSessionAccessStatus,
  Prisma,
  TableSessionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateOpaqueToken,
  hashToken,
  verifyTokenHash,
} from '../staff-auth/token-hash.util';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

@Injectable()
export class TableSessionAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async issueAccessToken(
    session: {
      id: string;
      companyId: string;
      branchId: string;
      guestLabel?: string | null;
      expiresAt?: Date | null;
    },
    tx: PrismaExecutor = this.prisma,
  ) {
    const token = generateOpaqueToken('balcona_customer');
    const expiresAt =
      session.expiresAt ??
      new Date(Date.now() + this.tokenHours() * 60 * 60 * 1000);
    const existingIdentity = await tx.customerSessionIdentity.findFirst({
      where: { tableSessionId: session.id },
      select: { id: true },
    });
    const data = {
      companyId: session.companyId,
      branchId: session.branchId,
      tableSessionId: session.id,
      displayName: session.guestLabel ?? undefined,
      accessTokenHash: hashToken(token),
      accessTokenStatus: CustomerSessionAccessStatus.active,
      accessTokenExpiresAt: expiresAt,
      accessTokenLastUsedAt: new Date(),
    };
    const identity = existingIdentity
      ? await tx.customerSessionIdentity.update({
          where: { id: existingIdentity.id },
          data,
          select: { id: true, accessTokenExpiresAt: true },
        })
      : await tx.customerSessionIdentity.create({
          data,
          select: { id: true, accessTokenExpiresAt: true },
        });

    return {
      customerAccessToken: token,
      customerAccessTokenExpiresAt: identity.accessTokenExpiresAt,
      customerSessionIdentityId: identity.id,
    };
  }

  async validateAccessToken(token: string, tableSessionId?: string) {
    const tokenHash = hashToken(token);
    const identity = await this.prisma.customerSessionIdentity.findUnique({
      where: { accessTokenHash: tokenHash },
      include: {
        tableSession: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
          },
        },
      },
    });

    if (
      !identity ||
      !identity.accessTokenHash ||
      !verifyTokenHash(token, identity.accessTokenHash) ||
      identity.accessTokenStatus !== CustomerSessionAccessStatus.active
    ) {
      throw new UnauthorizedException('Invalid table session access token');
    }

    if (tableSessionId && identity.tableSessionId !== tableSessionId) {
      throw new UnauthorizedException('Token does not match table session');
    }

    if (
      identity.accessTokenExpiresAt &&
      identity.accessTokenExpiresAt <= new Date()
    ) {
      await this.prisma.customerSessionIdentity.update({
        where: { id: identity.id },
        data: { accessTokenStatus: CustomerSessionAccessStatus.expired },
      });
      throw new UnauthorizedException('Table session access token expired');
    }

    if (!identity.tableSession) {
      throw new NotFoundException('Table session not found');
    }

    if (
      identity.tableSession.status === TableSessionStatus.closed ||
      identity.tableSession.status === TableSessionStatus.expired
    ) {
      throw new UnauthorizedException('Table session is closed');
    }

    await this.prisma.customerSessionIdentity.update({
      where: { id: identity.id },
      data: { accessTokenLastUsedAt: new Date() },
    });

    return identity;
  }

  async expireOldAccessTokens() {
    const result = await this.prisma.customerSessionIdentity.updateMany({
      where: {
        accessTokenStatus: CustomerSessionAccessStatus.active,
        accessTokenExpiresAt: { lte: new Date() },
      },
      data: { accessTokenStatus: CustomerSessionAccessStatus.expired },
    });

    return { expiredCustomerAccessTokens: result.count };
  }

  private tokenHours() {
    return this.configService.get<number>('customerAccess.tokenHours', 24);
  }
}

