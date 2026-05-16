import { Controller, Post, Get, Put, Delete, Req, Res, UnauthorizedException, Body, HttpStatus, BadRequestException, UsePipes, ValidationPipe, UseInterceptors, UploadedFile } from '@nestjs/common';

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


@Put('reset-password')
//@UsePipes(new ValidationPipe({ transform: true }))
async resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: Request, @Res() res: Response) {
  console.log('🔒 ControllerLayer: resetPassword start');

  const token = req.cookies?.authToken;
  if (!token) {
    console.log('❌ ControllerLayer: Missing auth token');
    return res.status(401).json({ message: 'Authorization token missing.' });
  }

  try {
    await this.authService.resetPassword(token, resetPasswordDto);
    console.log('✅ ControllerLayer: Password reset successful');
    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error('❌ ControllerLayer: Error resetting password', error);
    return res.status(400).json({ message: error.message || 'Password reset failed.' });
  }
}


  @Post('login')
  @UsePipes(new ValidationPipe({ transform: true })) // ✅ Enable DTO validation
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    console.log('controllerlayer login start');

    try {
      const token = await this.authService.login(loginDto.email, loginDto.password);

      console.log('controllerlayer process.env.NODE_ENV', process.env.NODE_ENV);

res.cookie('authToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  domain: 'sensitivedata.ca', // ✅ FIXED
  path: '/',
});

/*
 res.cookie('authToken', token, {
    httpOnly: true,
   secure: true,   // ⛔ Must be FALSE for localhost (HTTPS is required for Secure=True)
  sameSite: 'lax', // 🚀 Allows cross-origin requests
  domain: 'localhost', // ✅ Keeps cookie scoped to localhost
  path: '/',
 });
*/

      console.log('controllerlayer login end');
      return res.json({ token });

    } catch (error) {
      console.error('controllerlayer login error:', error);
      throw new BadRequestException('Invalid login credentials.');
    }
  }
}
