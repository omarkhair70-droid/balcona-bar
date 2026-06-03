import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { BranchAdminService } from './branch-admin.service';
import {
  BranchAdminOverviewQueryDto,
  CreateBranchDto,
  CreateFloorDto,
  CreateTableDto,
  RegenerateQrTokenDto,
  UpdateBranchDto,
  UpdateFloorDto,
  UpdateTableDto,
} from './dto/branch-admin.dto';
import {
  BranchFloorParamDto,
  BranchIdParamDto,
  BranchTableParamDto,
  CompanyIdParamDto,
} from './dto/branch-admin-param.dto';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class BranchAdminController {
  constructor(private readonly branchAdminService: BranchAdminService) {}

  @Get('companies/:companyId/branch-admin/overview')
  @RequiredPermission('tables.read', { companyIdParam: 'companyId' })
  getOverview(
    @Param() params: CompanyIdParamDto,
    @Query() query: BranchAdminOverviewQueryDto,
  ) {
    return this.branchAdminService.getOverview(params.companyId, query);
  }

  @Post('companies/:companyId/branch-admin/branches')
  @RequiredPermission('settings.manage', { companyIdParam: 'companyId' })
  createBranch(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateBranchDto,
  ) {
    return this.branchAdminService.createBranch(params.companyId, body);
  }

  @Patch('branch-admin/branches/:branchId')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  updateBranch(
    @Param() params: BranchIdParamDto,
    @Body() body: UpdateBranchDto,
  ) {
    return this.branchAdminService.updateBranch(params.branchId, body);
  }

  @Post('branch-admin/branches/:branchId/activate')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  activateBranch(@Param() params: BranchIdParamDto) {
    return this.branchAdminService.activateBranch(params.branchId);
  }

  @Post('branch-admin/branches/:branchId/deactivate')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  deactivateBranch(@Param() params: BranchIdParamDto) {
    return this.branchAdminService.deactivateBranch(params.branchId);
  }

  @Post('branches/:branchId/table-admin/floors')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  createFloor(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateFloorDto,
  ) {
    return this.branchAdminService.createFloor(params.branchId, body);
  }

  @Patch('branches/:branchId/table-admin/floors/:floorId')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  updateFloor(
    @Param() params: BranchFloorParamDto,
    @Body() body: UpdateFloorDto,
  ) {
    return this.branchAdminService.updateFloor(
      params.branchId,
      params.floorId,
      body,
    );
  }

  @Post('branches/:branchId/table-admin/tables')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  createTable(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateTableDto,
  ) {
    return this.branchAdminService.createTable(params.branchId, body);
  }

  @Patch('branches/:branchId/table-admin/tables/:tableId')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  updateTable(
    @Param() params: BranchTableParamDto,
    @Body() body: UpdateTableDto,
  ) {
    return this.branchAdminService.updateTable(
      params.branchId,
      params.tableId,
      body,
    );
  }

  @Post('branches/:branchId/table-admin/tables/:tableId/activate')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  activateTable(@Param() params: BranchTableParamDto) {
    return this.branchAdminService.activateTable(
      params.branchId,
      params.tableId,
    );
  }

  @Post('branches/:branchId/table-admin/tables/:tableId/deactivate')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  deactivateTable(@Param() params: BranchTableParamDto) {
    return this.branchAdminService.deactivateTable(
      params.branchId,
      params.tableId,
    );
  }

  @Post('branches/:branchId/table-admin/tables/:tableId/qr-token/generate')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  generateQrToken(@Param() params: BranchTableParamDto) {
    return this.branchAdminService.generateQrToken(
      params.branchId,
      params.tableId,
    );
  }

  @Post('branches/:branchId/table-admin/tables/:tableId/qr-token/regenerate')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  regenerateQrToken(
    @Param() params: BranchTableParamDto,
    @Body() body: RegenerateQrTokenDto,
  ) {
    return this.branchAdminService.regenerateQrToken(
      params.branchId,
      params.tableId,
      body,
    );
  }
}
