import { Controller, Post, Get, Put, Delete, Req, Res, UnauthorizedException, Body, HttpStatus, BadRequestException, UsePipes, ValidationPipe, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { multerConfig } from '../config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseFilters } from '@nestjs/common';

import { MulterExceptionFilter } from '../filters/multer-exception.filter';




// crud = post get put delete

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}



@Get('viewAvailableRoleSessions')
async getAvailableRoleSessions(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');
  return await this.chatService.getAvailableRoleSessions(token);
}

@Get('viewEnabledRoleSessions')
async getEnabledRoleSessions(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');
  return await this.chatService.getEnabledRoleSessions(token);
}




  @Put('updateUserSettings')
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateUserSettings(
    @Req() req: Request,
    @Body() body: { active_model: 'local_8B' | 'openai_4_mini' | 'openai_4_regular' }
  ) {
      if (!req.cookies.authToken) {
      throw new BadRequestException('User not authenticated');
      }
      await this.chatService.updateUserSettings(req.cookies.authToken, body.active_model);
      return { message: 'User settings updated successfully' };
    }


  @Post('cloneConversation')
  async cloneConversation(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: { user_id: number }
  ): Promise<void> {
    console.log("controller: cloneConversation called");

    const token = req.cookies?.authToken;
    const { user_id } = body;

    if (!token) {
      console.log('controllerlayer cloneConversation: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

    try {
      await this.chatService.cloneActiveSession(token, user_id);
      res.status(HttpStatus.OK).json({ message: 'Conversation cloned successfully' });
    } catch (error) {
      console.error("❌ Controller Layer: Error in cloneConversation", error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

// used by the switch screen when a user clicks on the disk icon button for a session
@Put('appendToActive')
async appendToActive(
  @Req() req: Request, 
  @Res() res: Response, 
  @Body() body: { session_id: number }
): Promise<void> {
  console.log("controller: appendToActive called");

  const token = req.cookies?.authToken;
  const { session_id } = body;

  if (!token) {
    console.log('controllerlayer appendToActive: missing Authorization cookie');
    throw new UnauthorizedException('Authorization token missing.');
  }

  try {
    await this.chatService.appendToActiveSession(token, session_id);
    res.status(HttpStatus.OK).json({ message: 'Session appended successfully' });
  } catch (error) {
    console.error("❌ Controller Layer: Error in appendToActive", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}

// called by the switch page.tsx as it needs to know the active session
@Get("viewUsers")
async getviewUsers(@Req() req: Request): Promise<{ message: string }> {
  console.log("🔍 controller: getviewUsers called");
    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
      console.log('controllerlayer viewUsers: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }
  return await this.chatService.getviewUsers(token);

}


// called by the clone page.tsx because it has a massive list table on the main page!
@Get("getAllUsers")
async getAllUsers(@Req() req: Request): Promise<{ message: string }> {
  console.log("🔍 controller: getAllUsers called");
    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
      console.log('controller: getAllUsers: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

  return await this.chatService.getAllUsers(token);
}

@Post('addsession')
async doAddSession(@Req() req: Request, @Res() res: Response, @Body() body: { session_desc: string}): Promise<void> {
  console.log("controller: start doAddSession");
  const { session_desc } = body;
  const token = req.cookies?.authToken;

  if (!token) {
    console.log('controllerlayer doAddSession: missing Authorization cookie');
    throw new UnauthorizedException('Authorization token missing.');
  }

  try {
    await this.chatService.doAddSession(token, session_desc);
    res.status(HttpStatus.OK).json({ message: 'Session added successfully' });
  } catch (error) {
    console.error("❌ Controller Layer: Error in doAddSession", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}


@Put('switchSession')
async switchSession(@Req() req: Request, @Res() res: Response, @Body() body: { session_id: number }): Promise<void> {
  console.log("controller: switchSession called");

  const token = req.cookies?.authToken;
  const { session_id } = body;

  if (!token) {
    console.log('controllerlayer switchSession: missing Authorization cookie');
    throw new UnauthorizedException('Authorization token missing.');
  }

  try {
    await this.chatService.switchSession(token, session_id);
    res.status(HttpStatus.OK).json({ message: 'Active session updated successfully' });
  } catch (error) {
    console.error("❌ Controller Layer: Error in switchSession", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}


@Put('doRemoveFlag')
async doRemoveFlag(@Req() req: Request, @Res() res: Response, @Body() body: { conversation_id: number, removed_flag: string }): Promise<void> {
  console.log("controller: doRemoveFlag called");

  const token = req.cookies?.authToken;
const { conversation_id, removed_flag } = body;
//    console.log('controllerlayer RemoveFlag' + conversation_id);
//    console.log('controllerlayer RemoveFlag' + removed_flag);

  if (!token) {
    console.log('controllerlayer RemoveFlag: missing Authorization cookie');
    throw new UnauthorizedException('Authorization token missing.');
  }

  try {
    await this.chatService.doRemoveFlag(token, conversation_id, removed_flag);
    res.status(HttpStatus.OK).json({ message: 'Remove Flag updated successfully' });
  } catch (error) {
    console.error("❌ Controller Layer: Error in doRemoveFlag", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}

@Get("AllConvervations")
async AllConvervations(@Req() req: Request): Promise<{ message: string }> {
  console.log("controller: AllConvervations called");
    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
      console.log('controllerlayer AllConvervations: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

  // ✅ Call the Service Layer
  return await this.chatService.getActiveConvervations(token);

}

@Get("creative-conversations")
async creativeConversations(@Req() req: Request, @Query("after_id") afterId?: string): Promise<{ message: string }> {
  const token = req.cookies?.authToken;

  if (!token) {
    throw new UnauthorizedException('Authorization token missing.');
  }

  const parsedAfterId = afterId ? Number(afterId) : 0;
  if (!Number.isInteger(parsedAfterId) || parsedAfterId < 0) {
    throw new BadRequestException('after_id must be a non-negative integer.');
  }

  return await this.chatService.getCreativeConversations(token, parsedAfterId);
}

@Get("getRemovedConvervations")
async getRemovedConvervations(@Req() req: Request): Promise<{ message: string }> {
  console.log("controller: getRemovedConvervations called");
    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
      console.log('controller: getRemovedConvervations: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

  // ✅ Call the Service Layer
  return await this.chatService.getRemovedConvervations(token);

}


@Get("SessionsByUserId")
async SessionsByUserId(@Req() req: Request): Promise<{ message: string }> {
  console.log("controller: SessionsByUserId called");
    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
      console.log('controller: SessionsByUserId: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

    try {
  // ✅ Call the Service Layer
  return await this.chatService.doSessionsByUserId(token);
    } catch (error) {
      console.error("❌ Controller: Error in SessionsByUserId", error);
      throw new UnauthorizedException(error.message);
    }
}


// in the manage conversations screen you can delete a session. 
// the sessionId is in the URL as per ReST
  @Delete('sessions/:sessionId')
  async deleteSessions(@Req() req: Request, @Res() res: Response): Promise<void> {
    console.log("controller: deleteSessions called");

    const token = req.cookies?.authToken;
  const sessionId = parseInt(req.params.sessionId, 10);

    if (!token) {
      console.log('controller deleteSessions: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

  if (isNaN(sessionId)) {  // ✅ Check for NaN before proceeding
    console.error("❌ controller deleteSessions: Invalid sessionId received:", req.params.sessionId);
    throw new BadRequestException('Invalid sessionId provided.');
  }

    try {
      await this.chatService.deleteSessions(token, sessionId);
      res.status(HttpStatus.OK).json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error("❌ Controller: Error in deleteSession", error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  }

// in the manage conversations screen there is the ability to delete a record	
@Delete('conversations/:conversation_id')
async deleteConversations(@Req() req: Request, @Res() res: Response): Promise<void> {
  console.log("controller: deleteConversations called");

  const token = req.cookies?.authToken;
  const conversation_id = parseInt(req.params.conversation_id, 10); // Fix parameter extraction

  if (!token) {
    console.log('controller deleteConversations: missing Authorization cookie');
    throw new UnauthorizedException('Authorization token missing.');
  }

  try {
    await this.chatService.deleteConversations(token, conversation_id); // Pass correct conversation_id
    res.status(HttpStatus.OK).json({ message: 'Conversation record deleted successfully' });
  } catch (error) {
    console.error("❌ Controller: Error in deleteConversations", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}



//
// injectapi same name for the url as for the actual function under the url makes its simple. also doXXXX is a default for servicelayer functionnames
// the return of arrConversation is appended to the display window
//
@Post("injectapi")
async injectAPI(@Req() req: Request): Promise<{ message: string }> {
    console.log("🔍 DEBUG: postInjectAPI called");

try 
  {
    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
        console.log("controller InjectAPI: missing Authorization cookie");
        throw new UnauthorizedException("Authorization token missing.");
    }
    console.log("cl injectAPI: extracted token from http");

    // ✅ Extract inputs from request body
    const { api_name, api_keywords, max_return, confidence } = req.body;
    console.log('cl, max_return ' , max_return);

    if (!api_name) {
        console.log("controller InjectAPI: missing required fields");
        throw new BadRequestException("Missing required fields: api_name.");
    }

    // ✅ Debugging extracted values
    // apin_name is defined as api_name?: 'snow_incident' | 'snow_kb';
    //console.log(`Extracted api_name: ${api_name}`);
    //    console.log(`Extracted confidence: ${confidence}`);

    // keywords are a list 1- 5 words separate with a space.
    //console.log(`Extracted api_keywords: ${api_keywords}`);
 
    // ✅ Call the Service Layer (note it returns a arrConversations)
    return await this.chatService.doInjectAPI(token, api_name, api_keywords, max_return, confidence);

  } catch (error) {
      console.error('controllerlayer doInjectAPI error:', error);
      throw new BadRequestException('You have encountered a system error.');
  }
}




// here


@Post('injectUpload')
@UseInterceptors(FileInterceptor('file', multerConfig))
@UseFilters(MulterExceptionFilter)  // 👈 ADD THIS LINE
async injectUpload(@UploadedFile() file: Express.Multer.File, @Req() req: Request): Promise<{ message: string }> {

   var DEBUG = true;

   if (DEBUG) { console.log("🔍 controller: injectUpload  called"); }
console.log("Full file object:", file);

    try 
    {
      // ✅ Keep the old way of reading the token
      const token = req.cookies?.authToken;

      if (!token) 
      {
        console.log('controller injectUpload: missing Authorization cookie');
        throw new UnauthorizedException('Authorization token missing.');
      }
   //   console.log('cl injectUpload: extracted token from http');

      if (!file) {
        console.log('controller injectUpload: missing file');
        throw new BadRequestException('Missing required file.');
      }

//      console.log('cl injectUpload: made it past file check');

      // ✅ Debugging extracted values
 //     console.log(`Extracted file: ${file.originalname}`);

      // Call the service layer to handle the file upload and database insertion
      return await this.chatService.doInjectUpload(token, file);
      //return { message: 'stubbed' };
    } catch (error) {
      console.error('controller injectUpload error:', error);
      throw new BadRequestException('You have encountered a system error.');
    }
  }



@Post('ensureSystemMessage')
async ensureSystemMessage(@Req() req: Request): Promise<void> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');
  await this.chatService.ensureSystemMessage(token);
}



//
// clear()
//
@Delete("clear")
@UsePipes(new ValidationPipe({ transform: true }))
async clearChat(@Req() req: Request): Promise<{ message: string }> {

    console.log('controller clearChat: start');

    // ✅ Keep the old way of reading the token
    const token = req.cookies?.authToken;

    if (!token) {
      console.log('controller clearchat: missing Authorization cookie');
      throw new UnauthorizedException('Authorization token missing.');
    }

  await this.chatService.clearConversation(token);
 //   console.log('controllerlayer clear end');

    return { message: "Chat history cleared successfully." };
}


//
// chatresponse()
//
  @Post('chatresponse')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getChatResponse(@Req() req: Request, @Res() res: Response) 
  {
  console.log('controller getChatResponse: start');

  const token = req.cookies?.authToken;
  const userPrompt = req.body.message;
  const libraryEnabled = req.body.libraryEnabled;

  if (!token) {
    console.log('❌ controller getChatResponse: Missing auth token');
    throw new UnauthorizedException('Authorization token missing.');
  }

  let iterator: AsyncIterator<string>;
  let firstChunk: string | undefined = undefined;
  let done = false;

  try {
      // chatresponse is the chatbot which always does the full context of knowledgesessions
    const stream = this.chatService.fetchChatResponse(token, userPrompt, libraryEnabled, true);
    iterator = stream[Symbol.asyncIterator]();

    // 🚨 This is where your service function executes up to its first `yield`
    const result = await iterator.next();
    firstChunk = result.value;
    done = result.done ?? false;

} catch (err) {
  let message = err instanceof Error ? err.message : 'Unknown server error';
  console.error('❌ controller getChatResponse: Startup error in chat stream:', message);
  message = 'Error: '+ message;
  res.status(500).send(message); // ✅ Fully expose message to frontend
  return;
}

  if (done || !firstChunk) {
    res.status(204).end(); // Gracefully end: no content to return
    return;
  }

  // ✅ Begin HTTP response now that backend prep succeeded
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.write(firstChunk); // 🔥 First moment streaming truly begins

  try {
    // 🔁 Manually call .next() repeatedly — same as for-await loop
    let result = await iterator.next();
    while (!result.done) {
      const chunk = result.value;
      res.write(chunk);
      result = await iterator.next(); // 🔁 resume service generator
    }

    res.end(); // ✅ All chunks sent
//    console.log('✅ Streaming complete');
  } catch (err) {
    console.error('❌ controller getChatResponse: Error during streaming:', err);
    res.end(); // Always finish the response if partially sent
  }
}




@Get("sessionTokenCount")
async getSessionTokenCount(@Req() req: Request, @Res() res: Response): Promise<void> {
  console.log("🔍 Controller: getSessionTokenCount called");

  const token = req.cookies?.authToken;

  if (!token) {
    console.log("controller getSessionTokenCount: missing Authorization cookie");
    throw new UnauthorizedException("Authorization token missing.");
  }

  try {
    const totalTokens = await this.chatService.getSessionTokenCount(token);
    res.status(HttpStatus.OK).json({ totalTokens });
  } catch (error) {
    console.error("❌ Controller: Error in getSessionTokenCount", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
}



  @Post('llmresponse')
  async llmResponse(@Req() req: Request, @Res() res: Response) {
    console.log('controller llmResponse: start');

  const token = req.cookies?.authToken;
  const userPrompt = req.body.message;
  const fullContext = req.body.full_context === true;

  if (!token) {
    console.log('❌ controller llmResponse: Missing auth token');
    throw new UnauthorizedException('Authorization token missing.');
  }

  let iterator: AsyncIterator<string>;
  let firstChunk: string | undefined = undefined;
  let done = false;

  try {
      // llmresponse does NOT use a covert rag
  const stream = this.chatService.fetchChatResponse(token, userPrompt, false, fullContext);

  //  const stream = this.chatService.fetchChatResponse(token, req.body.message, false);
    iterator = stream[Symbol.asyncIterator]();

    // 🚨 This is where your service function executes up to its first `yield`
    const result = await iterator.next();
    firstChunk = result.value;
    done = result.done ?? false;

} catch (err) {
  let message = err instanceof Error ? err.message : 'Unknown server error';
  console.error('❌ controller llmResponse: Startup error in chat stream:', message);
  message = 'Error: '+ message;
  res.status(500).send(message); // ✅ Fully expose message to frontend
  return;
}

  if (done || !firstChunk) {
    res.status(204).end(); // Gracefully end: no content to return
    return;
  }

res.setHeader('Content-Type', 'application/octet-stream');
res.removeHeader('Content-Length'); // ✅ Make sure length is not guessed
res.setHeader('Transfer-Encoding', 'chunked'); // ✅ Force chunked encoding


//console.log('🟢 sending FIRST chunk at', new Date().toISOString(), ':', JSON.stringify(firstChunk));
res.write(firstChunk);

  try {
    // 🔁 Manually call .next() repeatedly — same as for-await loop
    let result = await iterator.next();
    while (!result.done) {
      const chunk = result.value;

  res.write(chunk);
  result = await iterator.next();

    }

    res.end(); // ✅ All chunks sent
  } catch (err) {
    console.error('❌ controller llmResponse: Error during streaming:', err);
    res.end(); // Always finish the response if partially sent
  }
}


@Get('/user_roles')
async getUserRoles(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');
  return await this.chatService.getUserRoles(token);
}

@Get('/sessions/:id')
async getSessionById(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  const sessionId = parseInt(req.params.id, 10);

  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getSessionById(token, sessionId);
}

 
@Put('/sessions/:id')
async updateSession(
  @Req() req: Request,
  @Res() res: Response,
  @Body() body: { session_desc: string; session_type?: string; role_id?: number }
): Promise<void> {
  const token = req.cookies?.authToken;
  const sessionId = parseInt(req.params.id, 10);
  if (!token) throw new UnauthorizedException('Missing token');

  const result = await this.chatService.updateSession(token, sessionId, body);
  res.status(HttpStatus.OK).json(result);
}

@Post('/sessions')
async createSession(
  @Req() req: Request,
  @Res() res: Response,
  @Body() body: { session_desc: string; session_type?: string; role_id?: number }
): Promise<void> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  const result = await this.chatService.createSession(token, body);
  res.status(HttpStatus.OK).json(result);
}

// new stuff
@Get('allRoles')
async getAllRoles(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');
  return await this.chatService.getAllRoles(token);
}

@Get('allRoleSessions')
async getAllRoleSessions(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');
  return await this.chatService.getAllRoleSessions(token);
}

@Post('addUserRoleSession')
async doAddUserRoleSession(@Req() req: Request, @Body() body: { session_id: number }) {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  const { session_id } = body;
  return await this.chatService.doAddUserRoleSession(token, session_id);
}

@Delete('removeUserRoleSession')
async doRemoveUserRoleSession(@Req() req: Request, @Body() body: { session_id: number }) {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  const { session_id } = body;
  return await this.chatService.doRemoveUserRoleSession(token, session_id);
}

@Get('quickprompts')
async getQuickPrompts(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getQuickPrompts(token);
}

@Get('creative-subconscious-drives')
async getCreativeSubconsciousDrives(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeSubconsciousDrives(token);
}

@Get('creative-relationship')
async getCreativeRelationship(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeRelationship(token);
}

@Get('creative-beliefs')
async getCreativeBeliefs(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeBeliefs(token);
}

@Get('creative-goals')
async getCreativeGoals(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeGoals(token);
}

@Get('creative-safety-records')
async getCreativeSafetyRecords(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeSafetyRecords(token);
}

@Get('creative-mood')
async getCreativeMood(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeMood(token);
}

@Get('creative-temperament')
async getCreativeTemperament(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeTemperament(token);
}

@Get('creative-last-rag-context')
async getCreativeLastRagContext(@Req() req: Request): Promise<{ message: string }> {
  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException('Missing token');

  return await this.chatService.getCreativeLastRagContext(token);
}

// new

@Post("creativeresponse")
async creativeResponse(@Req() req: Request, @Res() res: Response) {
  console.log("🔍 Controller: creativeresponse called");

  const token = req.cookies?.authToken;
  if (!token) throw new UnauthorizedException("Missing token");

  const { message } = req.body;
  const result = await this.chatService.createCreativeResponse(token, message);

 // console.log("🔍 controller creativeresponse result:", result.message);

  res
    .status(HttpStatus.OK)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .send(result.message);          // <-- raw JSON array string
}




}
