import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffRole, StaffStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getRolePermissions,
  isStaffPermission,
  StaffPermission,
} from './permissions';

const companySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.CompanySelect;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  status: true,
  company: {
    select: companySelect,
  },
} satisfies Prisma.BranchSelect;

const staffUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  memberships: {
    where: {
      status: StaffStatus.active,
    },
    orderBy: [{ companyId: 'asc' }, { branchId: 'asc' }, { role: 'asc' }],
    select: {
      id: true,
      staffUserId: true,
      companyId: true,
      branchId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: companySelect,
      },
      branch: {
        select: branchSelect,
      },
    },
  },
} satisfies Prisma.StaffUserSelect;

type StaffUserWithMemberships = Prisma.StaffUserGetPayload<{
  select: typeof staffUserSelect;
}>;

type StaffMembershipWithScope = StaffUserWithMemberships['memberships'][number];
type CompanySummary = StaffMembershipWithScope['company'];
type BranchSummary = NonNullable<StaffMembershipWithScope['branch']>;

export interface StaffPermissionScope {
  companyId?: string;
  branchId?: string;
}

interface ResolvedScope extends StaffPermissionScope {
  company?: CompanySummary;
  branch?: BranchSummary;
}

interface EffectiveAccessBucket {
  roles: Set<StaffRole>;
  permissions: Set<StaffPermission>;
}

@Injectable()
export class StaffAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccess(staffUserId: string) {
    const staffUser = await this.findStaffUserOrThrow(staffUserId);
    const memberships = this.getGrantableMemberships(staffUser);
    const companyLevelMemberships = memberships.filter(
      (membership) => !membership.branchId,
    );
    const companyLevelBranches = await this.findCompanyLevelBranches(
      companyLevelMemberships,
    );
    const branchAccess = this.buildBranchAccess(
      memberships,
      companyLevelBranches,
    );

    return {
      staffUser: this.serializeStaffUser(staffUser),
      memberships: memberships.map((membership) =>
        this.serializeMembership(membership),
      ),
      effectiveAccess: {
        companies: this.buildCompanyAccess(memberships),
        branches: branchAccess,
        roles: this.sortRoles(this.uniqueRoles(memberships)),
        permissions: this.sortPermissions(
          this.permissionsForMemberships(memberships),
        ),
      },
    };
  }

  async can(
    staffUserId: string,
    permission: StaffPermission,
    scope: StaffPermissionScope = {},
  ) {
    if (!isStaffPermission(permission)) {
      throw new BadRequestException('Unknown staff permission');
    }

    const resolvedScope = await this.resolveScope(scope);
    const staffUser = await this.findStaffUserOrThrow(staffUserId);

    if (staffUser.status !== StaffStatus.active) {
      return this.permissionResult({
        allowed: false,
        reason: 'staff_user_inactive',
        staffUser,
        resolvedScope,
        rolesConsidered: [],
      });
    }

    const memberships = this.getGrantableMemberships(staffUser);
    const scopedMemberships = memberships.filter((membership) =>
      this.membershipAppliesToScope(membership, resolvedScope),
    );
    const rolesConsidered = this.sortRoles(this.uniqueRoles(scopedMemberships));
    const matchedMembership = scopedMemberships.find((membership) =>
      getRolePermissions(membership.role).includes(permission),
    );

    if (matchedMembership) {
      return this.permissionResult({
        allowed: true,
        reason: matchedMembership.branchId
          ? 'permission_granted_by_branch_membership'
          : 'permission_granted_by_company_membership',
        staffUser,
        resolvedScope,
        rolesConsidered,
        matchedMembership,
      });
    }

    return this.permissionResult({
      allowed: false,
      reason:
        scopedMemberships.length === 0
          ? 'no_active_membership_for_scope'
          : 'permission_not_granted',
      staffUser,
      resolvedScope,
      rolesConsidered,
    });
  }

  async assertCan(
    staffUserId: string,
    permission: StaffPermission,
    scope: StaffPermissionScope = {},
  ) {
    const result = await this.can(staffUserId, permission, scope);

    if (!result.allowed) {
      throw new ForbiddenException(result.reason);
    }

    return result;
  }

  private async findStaffUserOrThrow(
    staffUserId: string,
  ): Promise<StaffUserWithMemberships> {
    const staffUser = await this.prisma.staffUser.findUnique({
      where: { id: staffUserId },
      select: staffUserSelect,
    });

    if (!staffUser) {
      throw new NotFoundException('Staff user not found');
    }

    return staffUser;
  }

  private async resolveScope(scope: StaffPermissionScope): Promise<ResolvedScope> {
    let company: CompanySummary | undefined;
    let branch: BranchSummary | undefined;

    if (scope.branchId) {
      const foundBranch = await this.prisma.branch.findUnique({
        where: { id: scope.branchId },
        select: branchSelect,
      });

      if (!foundBranch) {
        throw new NotFoundException('Branch not found');
      }

      branch = foundBranch;

      if (scope.companyId && branch.companyId !== scope.companyId) {
        throw new BadRequestException('Branch does not belong to company');
      }

      company = branch.company;
    }

    if (scope.companyId && !company) {
      const foundCompany = await this.prisma.company.findUnique({
        where: { id: scope.companyId },
        select: companySelect,
      });

      if (!foundCompany) {
        throw new NotFoundException('Company not found');
      }

      company = foundCompany;
    }

    return {
      companyId: company?.id,
      branchId: branch?.id,
      company,
      branch,
    };
  }

  private getGrantableMemberships(staffUser: StaffUserWithMemberships) {
    if (staffUser.status !== StaffStatus.active) {
      return [];
    }

    return staffUser.memberships;
  }

  private async findCompanyLevelBranches(
    memberships: StaffMembershipWithScope[],
  ): Promise<BranchSummary[]> {
    const companyIds = [
      ...new Set(memberships.map((membership) => membership.companyId)),
    ];

    if (companyIds.length === 0) {
      return [];
    }

    return this.prisma.branch.findMany({
      where: {
        companyId: {
          in: companyIds,
        },
      },
      orderBy: [{ companyId: 'asc' }, { slug: 'asc' }],
      select: branchSelect,
    });
  }

  private buildCompanyAccess(memberships: StaffMembershipWithScope[]) {
    const companies = new Map<
      string,
      EffectiveAccessBucket & {
        company: CompanySummary;
        branchScope: 'all_branches' | 'selected_branches';
      }
    >();

    for (const membership of memberships) {
      const existing = companies.get(membership.companyId);
      const bucket =
        existing ??
        {
          company: membership.company,
          branchScope: 'selected_branches' as const,
          roles: new Set<StaffRole>(),
          permissions: new Set<StaffPermission>(),
        };

      bucket.roles.add(membership.role);
      this.addPermissions(bucket.permissions, membership.role);

      if (!membership.branchId) {
        bucket.branchScope = 'all_branches';
      }

      companies.set(membership.companyId, bucket);
    }

    return [...companies.values()].map((bucket) => ({
      company: bucket.company,
      branchScope: bucket.branchScope,
      roles: this.sortRoles([...bucket.roles]),
      permissions: this.sortPermissions([...bucket.permissions]),
    }));
  }

  private buildBranchAccess(
    memberships: StaffMembershipWithScope[],
    companyLevelBranches: BranchSummary[],
  ) {
    const branches = new Map<
      string,
      EffectiveAccessBucket & {
        company: CompanySummary;
        branch: BranchSummary;
        source: 'company_membership' | 'branch_membership' | 'mixed';
      }
    >();

    for (const branch of companyLevelBranches) {
      const companyMemberships = memberships.filter(
        (membership) =>
          membership.companyId === branch.companyId && !membership.branchId,
      );

      for (const membership of companyMemberships) {
        const bucket = this.getOrCreateBranchBucket(
          branches,
          branch,
          'company_membership',
        );
        bucket.roles.add(membership.role);
        this.addPermissions(bucket.permissions, membership.role);
      }
    }

    for (const membership of memberships) {
      if (!membership.branch) {
        continue;
      }

      const bucket = this.getOrCreateBranchBucket(
        branches,
        membership.branch,
        'branch_membership',
      );
      bucket.roles.add(membership.role);
      this.addPermissions(bucket.permissions, membership.role);
    }

    return [...branches.values()].map((bucket) => ({
      company: bucket.company,
      branch: this.serializeBranch(bucket.branch),
      source: bucket.source,
      roles: this.sortRoles([...bucket.roles]),
      permissions: this.sortPermissions([...bucket.permissions]),
    }));
  }

  private getOrCreateBranchBucket(
    branches: Map<
      string,
      EffectiveAccessBucket & {
        company: CompanySummary;
        branch: BranchSummary;
        source: 'company_membership' | 'branch_membership' | 'mixed';
      }
    >,
    branch: BranchSummary,
    source: 'company_membership' | 'branch_membership',
  ) {
    const existing = branches.get(branch.id);

    if (existing) {
      if (existing.source !== source) {
        existing.source = 'mixed';
      }

      return existing;
    }

    const bucket = {
      company: branch.company,
      branch,
      source,
      roles: new Set<StaffRole>(),
      permissions: new Set<StaffPermission>(),
    };
    branches.set(branch.id, bucket);

    return bucket;
  }

  private membershipAppliesToScope(
    membership: StaffMembershipWithScope,
    scope: ResolvedScope,
  ) {
    if (scope.branchId) {
      return (
        membership.companyId === scope.companyId &&
        (!membership.branchId || membership.branchId === scope.branchId)
      );
    }

    if (scope.companyId) {
      return membership.companyId === scope.companyId && !membership.branchId;
    }

    return true;
  }

  private permissionResult(input: {
    allowed: boolean;
    reason: string;
    staffUser: StaffUserWithMemberships;
    resolvedScope: ResolvedScope;
    rolesConsidered: StaffRole[];
    matchedMembership?: StaffMembershipWithScope;
  }) {
    return {
      allowed: input.allowed,
      reason: input.reason,
      staffUser: this.serializeStaffUser(input.staffUser),
      matchedMembership: input.matchedMembership
        ? this.serializeMembership(input.matchedMembership)
        : undefined,
      rolesConsidered: input.rolesConsidered,
      scope: {
        company: input.resolvedScope.company,
        branch: input.resolvedScope.branch
          ? this.serializeBranch(input.resolvedScope.branch)
          : undefined,
      },
    };
  }

  private permissionsForMemberships(
    memberships: StaffMembershipWithScope[],
  ): StaffPermission[] {
    const permissions = new Set<StaffPermission>();

    for (const membership of memberships) {
      this.addPermissions(permissions, membership.role);
    }

    return [...permissions];
  }

  private addPermissions(permissions: Set<StaffPermission>, role: StaffRole) {
    for (const permission of getRolePermissions(role)) {
      permissions.add(permission);
    }
  }

  private uniqueRoles(memberships: StaffMembershipWithScope[]): StaffRole[] {
    return [...new Set(memberships.map((membership) => membership.role))];
  }

  private sortRoles(roles: StaffRole[]): StaffRole[] {
    return [...roles].sort((left, right) => left.localeCompare(right));
  }

  private sortPermissions(permissions: StaffPermission[]): StaffPermission[] {
    return [...permissions].sort((left, right) => left.localeCompare(right));
  }

  private serializeStaffUser(staffUser: StaffUserWithMemberships) {
    return {
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      status: staffUser.status,
      createdAt: staffUser.createdAt,
      updatedAt: staffUser.updatedAt,
    };
  }

  private serializeMembership(membership: StaffMembershipWithScope) {
    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      scope: membership.branchId ? 'branch' : 'company',
      company: membership.company,
      branch: membership.branch ? this.serializeBranch(membership.branch) : null,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    };
  }

  private serializeBranch(branch: BranchSummary) {
    return {
      id: branch.id,
      companyId: branch.companyId,
      name: branch.name,
      slug: branch.slug,
      status: branch.status,
    };
  }
}
