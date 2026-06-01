import { Controller, Get, Param } from '@nestjs/common';
import { CompanySlugParamDto } from './dto/company-slug-param.dto';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':companySlug/branches')
  findBranches(@Param() params: CompanySlugParamDto) {
    return this.companiesService.findBranches(params.companySlug);
  }
}
