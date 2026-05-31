import * as bcrypt from 'bcryptjs'; 
import * as jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { auth_tokens } from '../repositories/interfaces';
import { Users, updateUsers, viewUsers } from '../repositories/interfaces';
import { Conversations, updateConversations, Sessions } from '../repositories/interfaces';
import * as dotenv from 'dotenv';
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { RegisterDto } from '../dto/register.dto';
import { readFileSync } from 'fs';
import { config } from '../config';

dotenv.config();


const PUBLIC_KEY = readFileSync(config.jwt.publicKeyPath, 'utf-8');

@Injectable()
export class AuthService 
{
  constructor(private readonly authRepository: AuthRepository) {}


  async resetPassword(token: string, resetPasswordDto: ResetPasswordDto): Promise<void> {
    console.log('🔒 ServiceLayer: resetPassword start');

  const recAuthtoken = await this.validateAuthToken(token);
  let recviewUsers: viewUsers | null;
  recviewUsers = await this.authRepository.getviewUser(recAuthtoken.user_id);

    // Verify old password
    const isPasswordValid = await bcrypt.compare(resetPasswordDto.oldPassword, recviewUsers.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Old password is incorrect.');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    
    // Update password
    await this.authRepository.updatePassword(recAuthtoken.user_id, hashedPassword);

    console.log('✅ ServiceLayer: Password updated successfully');
  }

//
// login()
//
async login(email: string, password: string): Promise<string> 
{
  console.log('serviceslayer login start');
  // Retrieve the user by email
  const user = await this.authRepository.findUserByEmail(email);
  if (!user) {
    console.log('serviceslayer login: no user found');
    throw new UnauthorizedException('Invalid email or password');
  }
  console.log('serviceslayer login: found a user');

  // Validate the password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid email or password');
  }

  // Generate a JWT
  console.log('serviceslayer login: generating the authToken');
  const crypto = require('crypto');
  const jti = crypto.randomBytes(16).toString('hex'); // Generates a 32-character hex string
  const authToken = await this.generateAuthToken(jti);

  // Insert the token into the auth_tokens table
  console.log('serviceslayer login: inserting the authToken');
  await this.authRepository.insertAuthToken(user.user_id, jti, authToken);
  console.log('serviceslayer login end');
  return authToken; 
}

async register(registerDto: RegisterDto): Promise<string> {
  const email = registerDto.email.trim().toLowerCase();
  const existingUser = await this.authRepository.findUserByEmail(email);
  if (existingUser) {
    throw new BadRequestException('An account already exists for that email.');
  }

  const hashedPassword = await bcrypt.hash(registerDto.password, 10);
  const firstName = registerDto.first_nm?.trim() || 'New';
  const lastName = registerDto.last_nm?.trim() || 'User';

  const userId = await this.authRepository.createUser({
    email,
    password: hashedPassword,
    first_nm: firstName,
    last_nm: lastName
  });

  const sessionId = config.seca.canonicalSessionId > 0
    ? config.seca.canonicalSessionId
    : await this.authRepository.createDefaultSession(userId);
  await this.authRepository.updateUserActiveSession(userId, sessionId);

  return this.login(email, registerDto.password);
}


//
// generateAuthToken()
//
private async generateAuthToken(jti: string): Promise<string> 
{
  console.log('serviceslayer generateAuthToken start');
  const payload = { jti };

  // Read the private key from the file system
  const privateKey = require('fs').readFileSync(
    config.jwt.privateKeyPath,
    'utf8',
  );

  if (!privateKey) {
    throw new Error('JWT_PRIVATE_KEY is not defined or cannot be read');
  }

  console.log('serviceslayer generateauthtoken - JWT Private Key loaded successfully from env');
  const signOptions: jwt.SignOptions = {
    algorithm: 'RS256',
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  };
  const token = jwt.sign(payload, privateKey, signOptions);

  console.log('serviceslayer generateauthtoken - Generated token:', token);
  // Decode and verify the expiratio
  const decoded = jwt.decode(token);

if (decoded && typeof decoded !== 'string' && decoded.exp) {
  console.log('Decoded Token exp:', new Date(decoded.exp * 1000).toString());
} else {
  console.error('Error: JWT token missing exp claim');
}

console.log('serviceslayer generateAuthToken end');
return token
}


private async validateAuthToken(token: string): Promise<auth_tokens> 
{
  //console.log('servicelayer validateAuthToken: start');
  let recAuthtoken: auth_tokens | null;

  try 
  {
    // console.log('servicelayer validateAuthToken: verifying JWT - input token:', token);
    jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });

    recAuthtoken = await this.authRepository.findauthtokenbyjwt(token);
    if (!recAuthtoken) 
    {
      throw new UnauthorizedException('Token not found');
    }

    //console.log('servicelayer validateAuthToken: token validated successfully');
  } 
  catch (error) 
  {
    if (error.name === 'TokenExpiredError') 
    {
      console.error('servicelayer validateAuthToken: JWT expired at:', error.expiredAt);
      throw error;
    } 
    else 
    {
      console.error('servicelayer validateAuthToken: JWT validation failed:', error.message);
      throw error;
    }
  }

  //console.log('servicelayer validateAuthToken: end');
  return recAuthtoken;
}

}
