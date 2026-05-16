import { IsString, IsOptional, IsBoolean } from 'class-validator';

// DTO for the chat response request (input)
export class ChatRequestDto {
  @IsString()
  token: string; // Only the JWT token is passed in headers

  @IsOptional()
  @IsBoolean()
  libraryEnabled?: boolean; // ✅ Now fully type-safe as a boolean
}

// DTO for the chat response output
export class ChatResponseDto {
  @IsString()
  message: string; // The chat response text
}

// ✅ New DTO for clearing chat (though not strictly necessary)
export class ClearRequestDto {
  @IsString()
  token: string;
}