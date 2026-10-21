import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TimeSlot } from '../time-slots/entities/time-slot.entity.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { Booking } from './entities/booking.entity.js';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<Booking> {
    const timeSlot = await this.timeSlotRepository.findOne({
      where: { id: createBookingDto.timeSlotId },
      relations: { booking: true },
    });

    if (!timeSlot) {
      throw new NotFoundException(
        `Time slot with id ${createBookingDto.timeSlotId} not found`,
      );
    }

    if (timeSlot.booking) {
      throw new ConflictException('This time slot is already booked');
    }

    const booking = this.bookingRepository.create({
      name: createBookingDto.name,
      email: createBookingDto.email,
      timeSlotId: createBookingDto.timeSlotId,
    });

    try {
      return await this.bookingRepository.save(booking);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        throw new ConflictException('This time slot is already booked');
      }
      throw error;
    }
  }

  findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({
      relations: { timeSlot: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { timeSlot: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    return booking;
  }
}
