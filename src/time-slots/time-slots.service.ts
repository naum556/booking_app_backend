import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto.js';
import { TimeSlot } from './entities/time-slot.entity.js';

@Injectable()
export class TimeSlotsService {
  constructor(
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
  ) {}

  create(createTimeSlotDto: CreateTimeSlotDto): Promise<TimeSlot> {
    const timeSlot = this.timeSlotRepository.create(createTimeSlotDto);
    return this.timeSlotRepository.save(timeSlot);
  }

  findAll(): Promise<TimeSlot[]> {
    return this.timeSlotRepository.find({
      order: { date: 'ASC', time: 'ASC' },
      relations: { booking: true },
    });
  }

  findAvailable(): Promise<TimeSlot[]> {
    return this.timeSlotRepository
      .createQueryBuilder('slot')
      .leftJoin('slot.booking', 'booking')
      .where('booking.id IS NULL')
      .orderBy('slot.date', 'ASC')
      .addOrderBy('slot.time', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<TimeSlot> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id },
      relations: { booking: true },
    });

    if (!timeSlot) {
      throw new NotFoundException(`Time slot with id ${id} not found`);
    }

    return timeSlot;
  }
}
