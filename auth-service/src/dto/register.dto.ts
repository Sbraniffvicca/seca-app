import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsString()
  first_nm?: string;

  @IsOptional()
  @IsString()
  last_nm?: string;
}
