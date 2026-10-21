import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeSlot } from '../time-slots/entities/time-slot.entity.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { Booking } from './entities/booking.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, TimeSlot])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
