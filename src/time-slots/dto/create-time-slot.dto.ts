import { IsDateString, IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';

export class CreateTimeSlotDto {
  /** Date in ISO format: YYYY-MM-DD */
  @IsDateString()
  @IsNotEmpty()
  date: string;

  /** Time in HH:mm or HH:mm:ss format */
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'time must be in HH:mm or HH:mm:ss format',
  })
  time: string;

  /** Duration in minutes */
  @IsInt()
  @Min(1)
  duration: number;
}
