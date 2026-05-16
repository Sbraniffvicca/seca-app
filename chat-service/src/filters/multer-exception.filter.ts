import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    console.error('📛 Multer upload error:', exception.message);

    response.status(400).json({ message: `Upload failed: ${exception.message}` });
  }
}
