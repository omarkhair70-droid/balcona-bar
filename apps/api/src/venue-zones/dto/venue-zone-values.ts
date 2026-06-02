import { VenueZoneStatus, VenueZoneType } from '@prisma/client';

export const VENUE_ZONE_TYPES = [
  VenueZoneType.branch,
  VenueZoneType.entrance,
  VenueZoneType.seating_area,
  VenueZoneType.cashier,
  VenueZoneType.kitchen,
  VenueZoneType.outdoor,
  VenueZoneType.custom,
] as const;

export const VENUE_ZONE_STATUSES = [
  VenueZoneStatus.active,
  VenueZoneStatus.inactive,
  VenueZoneStatus.archived,
] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
