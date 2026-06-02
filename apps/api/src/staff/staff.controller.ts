import { Controller, Get, Param, Query } from '@nestjs/common';
import { StaffAccessService } from './staff-access.service';
import { StaffCanQueryDto } from './dto/staff-can-query.dto';
import { StaffUserIdParamDto } from './dto/staff-user-id-param.dto';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly staffAccessService: StaffAccessService,
  ) {}

  @Get()
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':staffUserId/access')
  findAccess(@Param() params: StaffUserIdParamDto) {
    return this.staffAccessService.getAccess(params.staffUserId);
  }

  @Get(':staffUserId/can')
  can(@Param() params: StaffUserIdParamDto, @Query() query: StaffCanQueryDto) {
    return this.staffAccessService.can(params.staffUserId, query.permission, {
      companyId: query.companyId,
      branchId: query.branchId,
    });
  }
}
