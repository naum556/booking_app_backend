import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { Booking } from '../../bookings/entities/booking.entity.js';

@Entity('time_slots')
export class TimeSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time: string;

  /** Duration of the slot in minutes */
  @Column({ type: 'int' })
  duration: number;

  @OneToOne('Booking', 'timeSlot')
  booking: Relation<Booking> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
