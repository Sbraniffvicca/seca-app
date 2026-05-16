import { Module, Global } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { createPool, Pool } from 'mysql2/promise';

@Global() // Ensures this module is globally available (optional)
@Module({
  providers: [
    {
      provide: 'DATABASE_POOL',
      useFactory: async (): Promise<Pool> => {
        return createPool({
          host: 'localhost',
          user: 'chat_app_user',
          password: 'Fancylol',
          database: 'chat',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });
      }
    },
    AuthRepository, 
    AuthService
  ],
  controllers: [AuthController],
  exports: ['DATABASE_POOL'], // Ensures DATABASE_POOL is accessible elsewhere
})
export class AppModule {}
