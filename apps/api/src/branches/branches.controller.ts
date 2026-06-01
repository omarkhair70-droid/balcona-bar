import { Controller, Get, Param } from '@nestjs/common';
import { BranchIdParamDto } from './dto/branch-id-param.dto';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get(':branchId/tables')
  findTables(@Param() params: BranchIdParamDto) {
    return this.branchesService.findTables(params.branchId);
  }
}
