import {
  MenuCategoryStatus,
  MenuItemStatus,
  ModifierGroupStatus,
  ModifierOptionStatus,
  ModifierSelectionType,
  PreparationStation,
} from '@prisma/client';

export const MENU_CATEGORY_STATUSES = [
  MenuCategoryStatus.active,
  MenuCategoryStatus.inactive,
] as const;

export const MENU_ITEM_STATUSES = [
  MenuItemStatus.active,
  MenuItemStatus.inactive,
  MenuItemStatus.archived,
] as const;

export const MODIFIER_GROUP_STATUSES = [
  ModifierGroupStatus.active,
  ModifierGroupStatus.inactive,
] as const;

export const MODIFIER_OPTION_STATUSES = [
  ModifierOptionStatus.active,
  ModifierOptionStatus.inactive,
] as const;

export const MODIFIER_SELECTION_TYPES = [
  ModifierSelectionType.single,
  ModifierSelectionType.multiple,
] as const;

export const PREPARATION_STATIONS = [
  PreparationStation.barista,
  PreparationStation.kitchen,
  PreparationStation.dessert,
  PreparationStation.cashier,
] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
