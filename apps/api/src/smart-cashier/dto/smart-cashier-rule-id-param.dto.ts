import { IsUUID } from 'class-validator';

export class SmartCashierRuleIdParamDto {
  @IsUUID('4')
  ruleId!: string;
}
