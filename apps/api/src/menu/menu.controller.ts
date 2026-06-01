import { Controller, Get, Param } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { CompanySlugParamDto } from '../companies/dto/company-slug-param.dto';
import { ItemIdParamDto } from './dto/item-id-param.dto';
import { MenuService } from './menu.service';

@Controller()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('companies/:companySlug/menu')
  findCompanyMenu(@Param() params: CompanySlugParamDto) {
    return this.menuService.findCompanyMenu(params.companySlug);
  }

  @Get('branches/:branchId/menu')
  findBranchMenu(@Param() params: BranchIdParamDto) {
    return this.menuService.findBranchMenu(params.branchId);
  }

  @Get('menu/items/:itemId')
  findItem(@Param() params: ItemIdParamDto) {
    return this.menuService.findItem(params.itemId);
  }

  @Get('branches/:branchId/menu/unavailable')
  findUnavailableBranchItems(@Param() params: BranchIdParamDto) {
    return this.menuService.findUnavailableBranchItems(params.branchId);
  }
}
