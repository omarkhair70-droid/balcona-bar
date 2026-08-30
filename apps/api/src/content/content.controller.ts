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
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
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
  constructor(
    private readonly contentService: ContentService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('companies/:companyId/content-blocks')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.read', { companyIdParam: 'companyId' })
  listCompanyBlocks(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListContentBlocksQueryDto,
  ) {
    return this.contentService.listCompanyBlocks(params.companyId, query);
  }

  @Get('branches/:branchId/content-blocks')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.read', { branchIdParam: 'branchId' })
  listBranchBlocks(
    @Param() params: BranchIdParamDto,
    @Query() query: ListContentBlocksQueryDto,
  ) {
    return this.contentService.listBranchBlocks(params.branchId, query);
  }

  @Post('companies/:companyId/content-blocks')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.manage', { companyIdParam: 'companyId' })
  createCompanyBlock(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateContentBlockDto,
  ) {
    return this.contentService.createCompanyBlock(params.companyId, body);
  }

  @Post('branches/:branchId/content-blocks')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.manage', { branchIdParam: 'branchId' })
  createBranchBlock(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateContentBlockDto,
  ) {
    return this.contentService.createBranchBlock(params.branchId, body);
  }

  @Get('content-blocks/:contentBlockId')
  @UseGuards(StaffSessionGuard)
  async getBlock(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ContentBlockIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForContentBlock(
      currentStaff.staffUser.id,
      'content.read',
      params.contentBlockId,
    );
    return this.contentService.getBlock(params.contentBlockId);
  }

  @Patch('content-blocks/:contentBlockId')
  @UseGuards(StaffSessionGuard)
  async updateBlock(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ContentBlockIdParamDto,
    @Body() body: UpdateContentBlockDto,
  ) {
    await this.staffScopedAccessService.assertCanForContentBlock(
      currentStaff.staffUser.id,
      'content.manage',
      params.contentBlockId,
    );
    return this.contentService.updateBlock(params.contentBlockId, body);
  }

  @Post('content-blocks/:contentBlockId/activate')
  @UseGuards(StaffSessionGuard)
  async activateBlock(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ContentBlockIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForContentBlock(
      currentStaff.staffUser.id,
      'content.manage',
      params.contentBlockId,
    );
    return this.contentService.activateBlock(params.contentBlockId);
  }

  @Post('content-blocks/:contentBlockId/deactivate')
  @UseGuards(StaffSessionGuard)
  async deactivateBlock(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ContentBlockIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForContentBlock(
      currentStaff.staffUser.id,
      'content.manage',
      params.contentBlockId,
    );
    return this.contentService.deactivateBlock(params.contentBlockId);
  }

  @Post('content-blocks/:contentBlockId/archive')
  @UseGuards(StaffSessionGuard)
  async archiveBlock(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ContentBlockIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForContentBlock(
      currentStaff.staffUser.id,
      'content.manage',
      params.contentBlockId,
    );
    return this.contentService.archiveBlock(params.contentBlockId);
  }

  @Get('companies/:companyId/notification-templates')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.read', { companyIdParam: 'companyId' })
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
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.read', { branchIdParam: 'branchId' })
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
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.manage', { companyIdParam: 'companyId' })
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
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('content.manage', { branchIdParam: 'branchId' })
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
  @UseGuards(StaffSessionGuard)
  async getNotificationTemplate(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: NotificationTemplateIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForNotificationTemplate(
      currentStaff.staffUser.id,
      'content.read',
      params.templateId,
    );
    return this.contentService.getNotificationTemplate(params.templateId);
  }

  @Patch('notification-templates/:templateId')
  @UseGuards(StaffSessionGuard)
  async updateNotificationTemplate(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: NotificationTemplateIdParamDto,
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    await this.staffScopedAccessService.assertCanForNotificationTemplate(
      currentStaff.staffUser.id,
      'content.manage',
      params.templateId,
    );
    return this.contentService.updateNotificationTemplate(params.templateId, body);
  }

  @Post('notification-templates/:templateId/activate')
  @UseGuards(StaffSessionGuard)
  async activateNotificationTemplate(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: NotificationTemplateIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForNotificationTemplate(
      currentStaff.staffUser.id,
      'content.manage',
      params.templateId,
    );
    return this.contentService.activateNotificationTemplate(params.templateId);
  }

  @Post('notification-templates/:templateId/deactivate')
  @UseGuards(StaffSessionGuard)
  async deactivateNotificationTemplate(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: NotificationTemplateIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForNotificationTemplate(
      currentStaff.staffUser.id,
      'content.manage',
      params.templateId,
    );
    return this.contentService.deactivateNotificationTemplate(params.templateId);
  }
}
