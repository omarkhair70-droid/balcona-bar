import { IsNotEmpty, IsUUID } from 'class-validator';

export class BranchIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}

export class VenueZoneIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  venueZoneId!: string;
}
