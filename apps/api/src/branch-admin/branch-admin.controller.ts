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
  BranchIdParamDto,
  CompanyIdParamDto,
  FloorIdParamDto,
  TableIdParamDto,
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

  @Patch('table-admin/floors/:floorId')
  @RequiredPermission('settings.manage')
  updateFloor(@Param() params: FloorIdParamDto, @Body() body: UpdateFloorDto) {
    return this.branchAdminService.updateFloor(params.floorId, body);
  }

  @Post('branches/:branchId/table-admin/tables')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  createTable(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateTableDto,
  ) {
    return this.branchAdminService.createTable(params.branchId, body);
  }

  @Patch('table-admin/tables/:tableId')
  @RequiredPermission('settings.manage')
  updateTable(@Param() params: TableIdParamDto, @Body() body: UpdateTableDto) {
    return this.branchAdminService.updateTable(params.tableId, body);
  }

  @Post('table-admin/tables/:tableId/activate')
  @RequiredPermission('settings.manage')
  activateTable(@Param() params: TableIdParamDto) {
    return this.branchAdminService.activateTable(params.tableId);
  }

  @Post('table-admin/tables/:tableId/deactivate')
  @RequiredPermission('settings.manage')
  deactivateTable(@Param() params: TableIdParamDto) {
    return this.branchAdminService.deactivateTable(params.tableId);
  }

  @Post('table-admin/tables/:tableId/qr-token/generate')
  @RequiredPermission('settings.manage')
  generateQrToken(@Param() params: TableIdParamDto) {
    return this.branchAdminService.generateQrToken(params.tableId);
  }

  @Post('table-admin/tables/:tableId/qr-token/regenerate')
  @RequiredPermission('settings.manage')
  regenerateQrToken(
    @Param() params: TableIdParamDto,
    @Body() body: RegenerateQrTokenDto,
  ) {
    return this.branchAdminService.regenerateQrToken(params.tableId, body);
  }
}
