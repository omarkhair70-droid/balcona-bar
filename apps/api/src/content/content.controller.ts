import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateContentBlockDto,
  ListContentBlocksQueryDto,
  UpdateContentBlockDto,
} from './dto/content-block.dto';
import {
  BranchIdParamDto,
  CompanyIdParamDto,
  ContentBlockIdParamDto,
  NotificationTemplateIdParamDto,
} from './dto/content-param.dto';
import {
  CreateNotificationTemplateDto,
  ListNotificationTemplatesQueryDto,
  UpdateNotificationTemplateDto,
} from './dto/notification-template.dto';
import { ContentService } from './content.service';

@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('companies/:companyId/content-blocks')
  listCompanyBlocks(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListContentBlocksQueryDto,
  ) {
    return this.contentService.listCompanyBlocks(params.companyId, query);
  }

  @Get('branches/:branchId/content-blocks')
  listBranchBlocks(
    @Param() params: BranchIdParamDto,
    @Query() query: ListContentBlocksQueryDto,
  ) {
    return this.contentService.listBranchBlocks(params.branchId, query);
  }

  @Post('companies/:companyId/content-blocks')
  createCompanyBlock(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateContentBlockDto,
  ) {
    return this.contentService.createCompanyBlock(params.companyId, body);
  }

  @Post('branches/:branchId/content-blocks')
  createBranchBlock(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateContentBlockDto,
  ) {
    return this.contentService.createBranchBlock(params.branchId, body);
  }

  @Get('content-blocks/:contentBlockId')
  getBlock(@Param() params: ContentBlockIdParamDto) {
    return this.contentService.getBlock(params.contentBlockId);
  }

  @Patch('content-blocks/:contentBlockId')
  updateBlock(
    @Param() params: ContentBlockIdParamDto,
    @Body() body: UpdateContentBlockDto,
  ) {
    return this.contentService.updateBlock(params.contentBlockId, body);
  }

  @Post('content-blocks/:contentBlockId/activate')
  activateBlock(@Param() params: ContentBlockIdParamDto) {
    return this.contentService.activateBlock(params.contentBlockId);
  }

  @Post('content-blocks/:contentBlockId/deactivate')
  deactivateBlock(@Param() params: ContentBlockIdParamDto) {
    return this.contentService.deactivateBlock(params.contentBlockId);
  }

  @Post('content-blocks/:contentBlockId/archive')
  archiveBlock(@Param() params: ContentBlockIdParamDto) {
    return this.contentService.archiveBlock(params.contentBlockId);
  }

  @Get('companies/:companyId/notification-templates')
  listCompanyNotificationTemplates(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListNotificationTemplatesQueryDto,
  ) {
    return this.contentService.listCompanyNotificationTemplates(
      params.companyId,
      query,
    );
  }

  @Get('branches/:branchId/notification-templates')
  listBranchNotificationTemplates(
    @Param() params: BranchIdParamDto,
    @Query() query: ListNotificationTemplatesQueryDto,
  ) {
    return this.contentService.listBranchNotificationTemplates(
      params.branchId,
      query,
    );
  }

  @Post('companies/:companyId/notification-templates')
  createCompanyNotificationTemplate(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateNotificationTemplateDto,
  ) {
    return this.contentService.createCompanyNotificationTemplate(
      params.companyId,
      body,
    );
  }

  @Post('branches/:branchId/notification-templates')
  createBranchNotificationTemplate(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateNotificationTemplateDto,
  ) {
    return this.contentService.createBranchNotificationTemplate(
      params.branchId,
      body,
    );
  }

  @Get('notification-templates/:templateId')
  getNotificationTemplate(@Param() params: NotificationTemplateIdParamDto) {
    return this.contentService.getNotificationTemplate(params.templateId);
  }

  @Patch('notification-templates/:templateId')
  updateNotificationTemplate(
    @Param() params: NotificationTemplateIdParamDto,
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    return this.contentService.updateNotificationTemplate(
      params.templateId,
      body,
    );
  }

  @Post('notification-templates/:templateId/activate')
  activateNotificationTemplate(
    @Param() params: NotificationTemplateIdParamDto,
  ) {
    return this.contentService.activateNotificationTemplate(params.templateId);
  }

  @Post('notification-templates/:templateId/deactivate')
  deactivateNotificationTemplate(
    @Param() params: NotificationTemplateIdParamDto,
  ) {
    return this.contentService.deactivateNotificationTemplate(
      params.templateId,
    );
  }
}
