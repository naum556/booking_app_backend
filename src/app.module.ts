import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { Booking } from './bookings/entities/booking.entity.js';
import { TimeSlot } from './time-slots/entities/time-slot.entity.js';
import { TimeSlotsModule } from './time-slots/time-slots.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [TimeSlot, Booking],
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        },
        // Neon suspends idle computes, so the first connection after a cold
        // start can take several seconds (or fail once). Without these, TypeORM
        // gives up before Nest binds its port and the Vite dev proxy reports
        // ECONNREFUSED even though the backend is simply still starting.
        retryAttempts: Number(process.env['DB_RETRY_ATTEMPTS'] ?? 10),
        retryDelay: Number(process.env['DB_RETRY_DELAY_MS'] ?? 3000),
        connectTimeoutMillis: Number(process.env['DB_CONNECT_TIMEOUT_MS'] ?? 15000),
        keepAlive: true,
      }),
    }),
    AiModule,
    TimeSlotsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
