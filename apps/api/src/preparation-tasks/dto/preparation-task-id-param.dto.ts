import { IsUUID } from 'class-validator';

export class PreparationTaskIdParamDto {
  @IsUUID('4')
  taskId!: string;
}
