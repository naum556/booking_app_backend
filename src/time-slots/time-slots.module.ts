import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeSlot } from './entities/time-slot.entity.js';
import { TimeSlotsController } from './time-slots.controller.js';
import { TimeSlotsService } from './time-slots.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TimeSlot])],
  controllers: [TimeSlotsController],
  providers: [TimeSlotsService],
  exports: [TimeSlotsService, TypeOrmModule],
})
export class TimeSlotsModule {}
