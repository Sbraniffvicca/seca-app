import { Module, Global } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { Pool } from 'pg';
import { config } from './config';
import { PgDatabase } from './database';

@Global() // Ensures this module is globally available (optional)
@Module({
  providers: [
    {
      provide: 'DATABASE_POOL',
      useFactory: async (): Promise<PgDatabase> => {
        const pool = new Pool({
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.name
        });
        return new PgDatabase(pool);
      }
    },
    AuthRepository, 
    AuthService
  ],
  controllers: [AuthController],
  exports: ['DATABASE_POOL'], // Ensures DATABASE_POOL is accessible elsewhere
})
export class AppModule {}
