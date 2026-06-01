import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemIdParamDto } from './dto/cart-item-id-param.dto';
import { SessionIdParamDto } from './dto/session-id-param.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartService } from './cart.service';

@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('table-sessions/:sessionId/cart')
  getCart(@Param() params: SessionIdParamDto) {
    return this.cartService.getCart(params.sessionId);
  }

  @Post('table-sessions/:sessionId/cart/items')
  addItem(@Param() params: SessionIdParamDto, @Body() body: AddCartItemDto) {
    return this.cartService.addItem(params.sessionId, body);
  }

  @Patch('cart/items/:cartItemId')
  updateItem(@Param() params: CartItemIdParamDto, @Body() body: UpdateCartItemDto) {
    return this.cartService.updateItem(params.cartItemId, body);
  }

  @Delete('cart/items/:cartItemId')
  removeItem(@Param() params: CartItemIdParamDto) {
    return this.cartService.removeItem(params.cartItemId);
  }

  @Post('table-sessions/:sessionId/cart/clear')
  clearCart(@Param() params: SessionIdParamDto) {
    return this.cartService.clearCart(params.sessionId);
  }

  @Post('table-sessions/:sessionId/cart/validate')
  validateCart(@Param() params: SessionIdParamDto) {
    return this.cartService.validateCart(params.sessionId);
  }
}
