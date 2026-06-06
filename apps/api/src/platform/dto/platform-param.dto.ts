import { IsUUID } from "class-validator";

export class PlatformCompanyIdParamDto {
  @IsUUID()
  companyId!: string;
}
