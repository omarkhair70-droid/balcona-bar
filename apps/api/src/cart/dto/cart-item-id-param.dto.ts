import { IsUUID } from 'class-validator';

export class CartItemIdParamDto {
  @IsUUID('4')
  cartItemId!: string;
}
