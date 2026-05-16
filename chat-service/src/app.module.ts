import { Module, Global } from '@nestjs/common';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatRepository } from './repositories/chat.repository';
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
    ChatRepository, 
    ChatService
  ],
  controllers: [ChatController],
  exports: ['DATABASE_POOL'], // Ensures DATABASE_POOL is accessible elsewhere
})
export class AppModule {}
