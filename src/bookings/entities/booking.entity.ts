import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { TimeSlot } from '../../time-slots/entities/time-slot.entity.js';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @OneToOne('TimeSlot', 'booking', {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'time_slot_id' })
  timeSlot: Relation<TimeSlot>;

  @Column({ name: 'time_slot_id', unique: true })
  timeSlotId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
