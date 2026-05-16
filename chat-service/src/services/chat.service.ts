import { Injectable } from '@nestjs/common';
import { fetch } from 'undici'; // Ensure undici is used
import { TextDecoder } from 'util'; // Ensure TextDecoder is imported for Node.js
import { UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Cheerio } from 'cheerio';
import multer from 'multer';
import path from 'path';
import { auth_tokens } from '../repositories/interfaces';
import { Users, updateUsers, viewUsers } from '../repositories/interfaces';
import { Conversations, updateConversations, Sessions, view_sessions, QuickPrompts } from '../repositories/interfaces';
import { view_available_rolesessions, view_enabled_rolesessions, view_user_roles } from '../repositories/interfaces';
import { ChatResponseDto } from '../dto/chat.dto';
import { ChatRepository } from '../repositories/chat.repository';
import * as mammoth from "mammoth";
import * as pdfParse from "pdf-parse";

import { getSystemJsonFormatMessage, getcleanupMessage, transform_for_activemodel, getUserCommands,
call_activemodel, parseSubreplies, validateSubreplies, applySubreplies  } from '../helper/seca.helper';


interface GeminiContentItem {
  parts: [{ text: string }];
  role: string;
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: [{ text: string }];
    };
  }[];
}

// Define the APIResult interface
interface APIResult_KB {
  result: {
    sys_id: string;
    number: string;
    short_description: string;
    text: string;
    category: string;
    subcategory: string;
    tags: string;
  }[];
}

interface APIResult_INC {
  result: {
    sys_id: string;
    description: string;
  }[];
}

const PUBLIC_KEY_PATH = join(__dirname, '../../pubkey/public.key');
const PUBLIC_KEY = readFileSync(PUBLIC_KEY_PATH, 'utf-8');
      const estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };


@Injectable()
export class ChatService {
  constructor(private readonly chatRepository: ChatRepository) {}

async getAvailableRoleSessions(token: string): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const arr: view_available_rolesessions[] = await this.chatRepository.getAvailableRoleSessions(recAuthtoken.user_id);
  return { message: JSON.stringify(arr) };
}

async getEnabledRoleSessions(token: string): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const arr: view_enabled_rolesessions[] = await this.chatRepository.getEnabledRoleSessions(recAuthtoken.user_id);
  return { message: JSON.stringify(arr) };
}





async updateUserSettings(token: string, activeModel: 'local_8B' | 'openai_4_mini'): Promise<void> {
  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);
  await this.chatRepository.updateUserActiveModel(recAuthtoken.user_id, activeModel);
}


async cloneActiveSession(token: string, targetUserId: number): Promise<void> {
//  console.log("🔍 Service Layer: cloneActiveSession start");

  // ✅ Step 1: Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);

  // ✅ Step 2: Get the active session of the current user
  const activeUser = await this.chatRepository.getviewUser(recAuthtoken.user_id);

  if (!activeUser.active_session_id) {
    throw new BadRequestException("No active session available to clone.");
  }

  // ✅ Step 3: Ensure `session_desc` is **not null** and has a valid value
  if (!activeUser.session_desc || activeUser.session_desc.trim() === "") {
    throw new BadRequestException("Session description cannot be empty when cloning.");
  }

  // ✅ Step 4: Clone the session and get the new session_id
  const newSessionId = await this.chatRepository.InsertSession(targetUserId, activeUser.session_desc);

//  console.log(`✅ Service Layer: New cloned session created with session_id: ${newSessionId}`);

  // ✅ Step 5: Copy all conversations from the old session to the new session
  await this.chatRepository.appendToActiveSession(newSessionId, activeUser.active_session_id);

//  console.log(`✅ Service Layer: Conversations copied from session ${activeUser.active_session_id} to ${newSessionId}`);

  // ✅ Step 6: Update the target user's active session to the newly cloned session
  //await this.chatRepository.updateUserActiveSession(targetUserId, newSessionId);

//  console.log("✅ Service Layer: User's active session updated.");
}




//
// getviewUsers()
// used by the switch settings screen to display the active session and phone number
//
async getviewUsers(token: string): Promise<{ message: string }> {
//  console.log("🔍 Service Layer: getCitations start");

  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);
  //console.log(`✅ Token validated for user_id: ${recAuthtoken.user_id}`);

  let recviewUsers: viewUsers | null;
  recviewUsers = await this.chatRepository.getviewUser(recAuthtoken.user_id);
	
//  console.log("✅ Service Layer: returning viewUsers");
  return { message: JSON.stringify(recviewUsers) };
}

async getSessionTokenCount(token: string): Promise<number> {
//  console.log("🔍 Service Layer: getSessionTokenCount start");

  // ✅ Validate auth token and retrieve user
  const recAuthtoken = await this.validateAuthToken(token);
  const recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

  // ✅ Get token count for active session
  return await this.chatRepository.getSessionTokenCount(recUsers.active_session_id);
}



async appendToActiveSession(token: string, sessionIdToAppend: number): Promise<{ message: string }> {
  console.log("🔍 Service Layer: appendToActiveSession start");

  // ✅ Step 1: Validate token and retrieve user_id
  const recAuthtoken = await this.validateAuthToken(token);

  // ✅ Step 2: Fetch the user's active session
  const recviewUsers = await this.chatRepository.getviewUser(recAuthtoken.user_id);

  if (!recviewUsers.active_session_id) {
    throw new BadRequestException("No active session available to append to.");
  }

  const activeSessionId = recviewUsers.active_session_id;

  // ✅ Step 3: Prevent appending a session to itself
  if (activeSessionId === sessionIdToAppend) {
    throw new BadRequestException("Cannot append a session to itself.");
  }

  // ✅ Step 4: Call repo layer to copy conversations over
  await this.chatRepository.appendToActiveSession(activeSessionId, sessionIdToAppend);

  return { message: "Conversations appended successfully." };
}


//
// deleteConversations()
//
async deleteConversations(token:string, conversation_id: number): Promise<{ message: string }> {
//  console.log("🔍 Service Layer: deleteConversations start");
  const recAuthtoken = await this.validateAuthToken(token);

  await this.chatRepository.deleteConversations(conversation_id);
	
return { message: "Conversation deleted successfully" };

}


//
// deleteSessions()
//
async deleteSessions(token: string, session_id: number): Promise<{ message: string }> {
//  console.log("🔍 Service Layer: deleteSessions start with session_id of", session_id);

  // Validate token
  const recAuthtoken = await this.validateAuthToken(token);

  // 🔍 Get the user's record (to check active session)
  const recviewUsers = await this.chatRepository.getviewUser(recAuthtoken.user_id);

  // 🔴 Check if the user is trying to delete the active session
  if (recviewUsers.active_session_id === session_id) {
    console.log("⚠️ User is attempting to delete the active session. Updating instead.");

    // ✅ Call `updateUsers` to handle active session update
    await this.chatRepository.updateUsers({
      user_id: recAuthtoken.user_id,
      active_session_id: null, // Set active session to null or another default value
    });
  }

  // ✅ Safe to delete session (cascades to `conversations` via ON DELETE CASCADE)
  await this.chatRepository.deleteSessions(session_id);

  return { message: "Session deleted successfully" };
}


async getAllUsers(token: string): Promise<{ message: string }> {
//  console.log("🔍 Service Layer: getAllUsers start");

  // ✅ Step 1: Validate token and get the current user ID
  const recAuthtoken = await this.validateAuthToken(token);
  const currentUserId = recAuthtoken.user_id;

  // ✅ Step 2: Retrieve all users **except** the current user
  let arrUsers: Users[] = await this.chatRepository.getAllUsersExcept(currentUserId) || [];

  return { message: JSON.stringify(arrUsers) };
}


//
// doRemoveFlag()
// used by the EditConversations screen for actioning a removal when the click the slider.  
//
async doRemoveFlag(token: string, conversation_id: number, removed_flag: string): Promise<void> {
//  console.log("🔍 Service Layer: doRemoveFlag start");

  const recAuthtoken = await this.validateAuthToken(token);

//  console.log("🔍 Service Layer: conversationid is "+ conversation_id );
//  console.log("🔍 Service Layer: RemoveFlag is "+ removed_flag );

  let recupdateConversations: updateConversations | null = null;
  recupdateConversations = {
    conversation_id: conversation_id,
    removed_flag: removed_flag
  };

  await this.chatRepository.updateConversations(recupdateConversations);
}



async doAddSession(token: string, session_desc: string | undefined): Promise<void> {
 // console.log("🔍 Service Layer: doAddSession start");

  if (!session_desc) {
    throw new BadRequestException("Session description cannot be empty.");
  }

  // ✅ Step 1: Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);

  // ✅ Step 2: Insert the new session and capture its `session_id`
  const newSessionId = await this.chatRepository.InsertSession(recAuthtoken.user_id, session_desc);

 // console.log(`✅ Service Layer: New session created with session_id: ${newSessionId}`);

  // ✅ Step 3: Update the user's `active_session_id`
  await this.chatRepository.updateUserActiveSession(recAuthtoken.user_id, newSessionId);

//  console.log("✅ Service Layer: User's active session updated.");
}



//
// switchSession()
// used by the ChangeSettings screen for when users click the makeactive button 
//
async switchSession(token: string, session_id: number): Promise<void> {
//  console.log("🔍 Service Layer: switchSession start");

  // Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);

    const session = await this.chatRepository.getSessionById(session_id);
    if (session.session_owner_user_id !== recAuthtoken.user_id)
    {
        console.error('service layer: error cannot update someone elses session record');
        throw new BadRequestException("Session Update failed-invalid ownership.");
    }

  // Create a recUsers object, with the user_id and updated active_session_id
  let recUsers: updateUsers | null = null;
  recUsers = {
    user_id: recAuthtoken.user_id,
    active_session_id: session_id,
    // Add other necessary fields if required
  };

  // Call the repository layer to update the user record
  await this.chatRepository.updateUsers(recUsers);

//  console.log("✅ Service Layer: active session updated");
}



async ensureSystemMessage(token: string): Promise<void> {
  const recAuthtoken = await this.validateAuthToken(token);
 
   //   console.log('sl: ensuring 1');

  if (!recAuthtoken) throw new BadRequestException("Invalid token");

  const recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);
  const count = await this.chatRepository.ConversationCount(recUsers.active_session_id);
  if (count === 0) {

const sysMsg: Conversations = {
  session_id: recUsers.active_session_id,
  user_id: recUsers.user_id,
  role: 'system', // 👈 still a string, but context-aware now
  removed_flag: 'IN',
  content: "You are a helpful assistant.",
  token_count: 6,
};
  //    console.log('sl: ensuring 2');

    await this.chatRepository.insertConversation(sysMsg);
  }
}


//
// doinjectupload()
// this is the type of upload where there is no folder picklist, instead the entire file is saved in the conversations table
// this is used by the advanceddocs screen when a user clicks the paperclick to do an upload
//
async doInjectUpload(token: string, file: Express.Multer.File): Promise<{ message: string }> {
    console.log("🔍 ServiceLayer: doInjectUpload called");

    // ✅ Validate auth token
    const recAuthtoken = await this.validateAuthToken(token);
    if (!recAuthtoken) {
        throw new BadRequestException("Invalid authentication token.");
    }

    // ✅ Ensure file exists
    if (!file || !file.buffer) {
        console.error("❌ServiceLayer: doInjectUpload Error: No file provided.");
        throw new BadRequestException("File upload failed—no file buffer available.");
    }

    console.log(`✅ File received: ${file.originalname} (${file.mimetype})`);

    let extractedText = "";

    try {
        if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            // ✅ Extract DOCX text using `mammoth`
//            const result = await mammoth.extractRawText({ buffer: file.buffer });
const arrayBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength);
const result = await mammoth.extractRawText({ buffer: file.buffer });

            extractedText = result.value.trim();
        } 
        else if (file.mimetype === "application/pdf") {
            // ✅ Extract PDF text using `pdf-parse`
     console.log("start");
            const result = await pdfParse(file.buffer);
            extractedText = result.text.trim();
     console.log("end");
        } 
    else if (file.mimetype === "text/plain") {
        // ✅ Extract TXT text (no parsing needed)
        extractedText = file.buffer.toString("utf-8").trim();
    }
        else {
              console.error("❌ Unsupported MIME type:", file.mimetype);
            throw new BadRequestException("Unsupported file type. Only DOCX and PDF are allowed.");
        }
    } catch (error) {
        console.error("❌ Error extracting text:", error);
        throw new BadRequestException("Failed to extract text from the document.");
    }

    if (!extractedText) {
        throw new BadRequestException("Extracted text is empty.");
    }

    // get the user record
    let recUsers: Users | null;
    recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

    let arrConversations: Conversations[] = [];
   
const fileConversation: Conversations = {
  session_id: recUsers.active_session_id,
  user_id: recUsers.user_id,
  role: 'upl data',
  removed_flag: 'IN',
  content: extractedText, // Store full file text
  upl_filename: file.originalname, // Store just the filename
};
      const estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      fileConversation.token_count = fileConversation.content ? estimateTokens(fileConversation.content) : 0;

    arrConversations.push(fileConversation);
    await this.chatRepository.insertConversation(fileConversation);

    return { message: JSON.stringify(arrConversations) };

}

/// keep around for tracking incase - delete soon
  async OLDdoInjectUpload(token: string, file: Express.Multer.File): Promise<{ message: string }> {
//    console.log("🔍 Servicelayer: doInjectUpload called");

    // Validate auth token
    const recAuthtoken = await this.validateAuthToken(token);
    if (!recAuthtoken) {
      throw new BadRequestException('Invalid authentication token.');
    }

    // Ensure file exists
    if (!file) {
      console.error("❌ Error: No file provided.");
      throw new BadRequestException('File upload failed—no file path available.');
    }

 //   console.log(`✅ File received: ${file.originalname}`);

    // get the user record
    let recUsers: Users | null;
    recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

    let arrConversations: Conversations[] = [];

    // Check if user has existing conversations
    const ciConversationCount = await this.chatRepository.ConversationCount(recUsers.active_session_id);
    
    if (ciConversationCount === 0) {
      const system_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
        role: 'system',
        removed_flag: 'IN',
        content: "You are a helpful assistant.",
      };

      const estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      system_conversation.token_count = system_conversation.content ? estimateTokens(system_conversation.content) : 0;

      arrConversations.push(system_conversation);
      await this.chatRepository.insertConversation(system_conversation);
    }

    // Store file info
const fileContent = file.buffer.toString('utf-8'); // Convert full file buffer to string

const fileConversation: Conversations = {
  session_id: recUsers.active_session_id,
  user_id: recUsers.user_id,
  role: 'upl data',
  removed_flag: 'IN',
  content: fileContent, // Store full file text
  upl_filename: file.originalname, // Store just the filename
};

      const estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      fileConversation.token_count = fileConversation.content ? estimateTokens(fileConversation.content) : 0;

    arrConversations.push(fileConversation);
    await this.chatRepository.insertConversation(fileConversation);

    return { message: JSON.stringify(arrConversations) };
  }



//
// doInjectAPI()
// used by the advanceddoc screen when users click the inject button
//
async doInjectAPI(token: string, inApi_name, inApi_keywords, inMax_return, inConfidence): Promise<{ message: string }> {
//  console.log("🔍 Service Layer: doInjectAPI start");

  // let for local variables (note excludes const)
  let lvAPI = ""; 
  let arrConversations: Conversations[] = [];

  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);
  //console.log(`✅ Token validated for user_id: ${recAuthtoken.user_id}`);

  // get the user record
  let recUsers: Users | null;
  recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

  // if new conversation 
  const ciConversationCount = await this.chatRepository.ConversationCount(recUsers.active_session_id);
  if (ciConversationCount === 0) 
  {
    const system_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
    role: 'system',
        removed_flag: 'IN',
    content: "You are a helpful assistant.",
    };

      let estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      system_conversation.token_count = system_conversation.content ? estimateTokens(system_conversation.content) : 0;

    arrConversations.push(system_conversation);
    await this.chatRepository.insertConversation(system_conversation);
  }  

  // build the api calls
 // console.log("✅ Service Layer: inApi_name is ", inApi_name);

  if ((inApi_name === 'Verified') || (inApi_name === 'Unverified')) 
  {

    const apicall_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
    role: 'rag_bid keywords',
        removed_flag: 'IN',
    content: inApi_keywords,
    };

      const estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      apicall_conversation.token_count = apicall_conversation.content ? estimateTokens(apicall_conversation.content) : 0;

    arrConversations.push(apicall_conversation);
    await this.chatRepository.insertConversation(apicall_conversation);
   
  //  console.log(' sl = injectApi with inMax_return ', inMax_return); 
    const arrRagConversations = await this.chatRepository.fetchRag_v_Conversations(inApi_keywords, recUsers.active_session_id, recAuthtoken.user_id, inMax_return, inConfidence, inApi_name);
    //console.log('Service layer - from rag got:', JSON.stringify(arrRagConversations, null, 2));

    for (const rag_conversation of arrRagConversations) {

      let estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      rag_conversation.token_count = rag_conversation.content ? estimateTokens(rag_conversation.content) : 0;

      arrConversations.push(rag_conversation);
      await this.chatRepository.insertConversation(rag_conversation);
    }
  }

  //console.log("✅ Service Layer: returning conversation");
  return { message: JSON.stringify(arrConversations) }; // ✅ Temporary JSON response
}



//
// getActiveConvervations()
// used by the use-effect for both casualchat and the advanceddocs
// note that the casual chat screen has screen filters to only display the assistant and the user records and skips over the others
// this should be filtered to only show the active converstion records
//
async getActiveConvervations(token: string): Promise<{ message: string }> {
 // console.log("🔍 Service Layer: getAllConvervations start");

  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);
  //console.log(`✅ Token validated for user_id: ${recAuthtoken.user_id}`);

    let recUsers: Users | null;
    recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

  // Step 1: Create an empty local array based on the interface definition
  let arrConversations: Conversations[] = [];

  // Step 2: Call the repo layer with the authtokenRec.user_id
  //arrConversations = await this.chatRepository.getConversationHistory(recUsers.active_session_id);
  arrConversations = await this.chatRepository.getActiveConversations(recUsers.active_session_id);
  //console.log('Service layer - Retrieved Conversations:', JSON.stringify(arrConversations, null, 2));
	
  return { message: JSON.stringify(arrConversations) }; // ✅ Temporary JSON response
}

//
// getRemovedConvervations()
// used by the useeffect on the edit conversations screen. 
// returns even the removedrecords 
//
async getRemovedConvervations(token: string): Promise<{ message: string }> {
 // console.log("🔍 Service Layer: getRemovedConvervations start");

  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);
  //console.log(`✅ Token validated for user_id: ${recAuthtoken.user_id}`);

    let recUsers: Users | null;
    recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

  // Step 1: Create an empty local array based on the interface definition
  let arrConversations: Conversations[] = [];

  // Step 2: Call the repo layer with the authtokenRec.user_id
  arrConversations = await this.chatRepository.getRemovedConversations(recUsers.active_session_id);
  //console.log('Service layer - Retrieved Conversations:', JSON.stringify(arrConversations, null, 2));
	
  return { message: JSON.stringify(arrConversations) }; // ✅ Temporary JSON response
}


//
// updateSessionDescription()
// used on the Change Settings when user clicks the save0edits button as part of changing the session text
//
async updateSessionDescription(token: string, sessionId: number, session_desc: string): Promise<void> {
 // console.log("🔍 Service Layer: updateSessionDescription start");

  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);

  // ✅ Update the session description
  await this.chatRepository.updateSessionDescription(recAuthtoken.user_id, sessionId, session_desc);
}


//
// doSessionsByUserId()
// used by the useeffect on the changesettings screen to display all the sessions
//
async doSessionsByUserId(token: string): Promise<{ message: string }> {
 // console.log("🔍 Service Layer: doSessionsByUserId start");

  // ✅ Validate token and get user ID
  const recAuthtoken = await this.validateAuthToken(token);
  //console.log(`✅ Token validated for user_id: ${recAuthtoken.user_id}`);


  // Step 1: Create an empty local array based on the interface definition
  let arrSessions: view_sessions[] = [];

  // Step 2: Call the repo layer with the authtokenRec.user_id
  arrSessions = await this.chatRepository.getSessionsByUserId(recAuthtoken.user_id);
	
  return { message: JSON.stringify(arrSessions) }; // ✅ Temporary JSON response
}


//
// clearConversation()
// used on both the casualchat and the advanceddocs screen when user clicks the clear button. note this physically deletes ALL conversation records
// in the future we could add a conversations_history table to take a snapshot for audit purposes. 
// clear is bad. users should create NEW sessions typically. clearing and then reusing is an abuse of this feature - clear is for mistakes or casual-sessions.
//
 async clearConversation(token: string): Promise<void> {
//    console.log('Service Layer clear start');

  // Validate the token (note it will check if tampered-against-pubkey, then in the repolayer check if expired before retrieving user_id information
  const recAuthtoken = await this.validateAuthToken(token);

    let recUsers: Users | null;
    recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

  await this.chatRepository.deleteConversation(recUsers.active_session_id);
 //   console.log('Service Layer clear end');

}



//
// fetchChatResponse()
// called by the sendLLM button click. called from both the chat (ie chatbot) and the docs (ie ask ai) screens
// when called by casualchat there is a libraryenabled value possible, when called from advanceddoc the libraryenabled is always NULL
//
async *fetchChatResponse(token: string, userPrompt: string, libraryEnabled: boolean, fullContext: boolean): AsyncIterable<string> {
  
  // declare variables global to this function
  let normalizedMessages;

//  console.log('ServiceLayer step 1 - fetchChatResponse: start');
  // Validate the token (note it will check if tampered-against-pubkey, then in the repolayer check if expired before retrieving user_id information
  const recAuthtoken = await this.validateAuthToken(token);

  let recUsers: Users | null;
  recUsers = await this.chatRepository.getUser(recAuthtoken.user_id);

  // Step 1: Create an empty local array based on the interface definition
  let arrConversations: Conversations[] = [];

  // Step 2: Call the repo layer to get the past conversations
  arrConversations = await this.chatRepository.getActiveConversations(recUsers.active_session_id);

  //Step 3: check if empty conversation then add to array a standard system record, re-display conversation array TODO insert system rec into db.
  if (arrConversations.length === 0) {
    const system_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
        removed_flag: 'IN',
      role: 'system',
      content: "You are a helpful assistant.",
    };
    let estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
    system_conversation.token_count = system_conversation.content ? estimateTokens(system_conversation.content) : 0;
    arrConversations.push(system_conversation);
    await this.chatRepository.insertConversation(system_conversation);
  }

  // do rag note this is ONLY ever set from the chatbot as part of the covert-rag concept of a chatbot
  if (libraryEnabled)
  {

    const arrRagConversations = await this.chatRepository.fetchRag_v_Conversations(userPrompt, recUsers.active_session_id, recAuthtoken.user_id, 50, .75, 'Verified');
  
    if (arrRagConversations.length > 0)
    {
      console.log('inserting the keywords');

      const apicall_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
        role: 'rag_bid keywords',
        removed_flag: 'IN',
        content: userPrompt,
      };

      let estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      apicall_conversation.token_count = apicall_conversation.content ? estimateTokens(apicall_conversation.content) : 0;

      arrConversations.push(apicall_conversation);
      await this.chatRepository.insertConversation(apicall_conversation);
    }

    for (const rag_conversation of arrRagConversations) {
      let estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
      rag_conversation.token_count = rag_conversation.content ? estimateTokens(rag_conversation.content) : 0;
      arrConversations.push(rag_conversation);
      await this.chatRepository.insertConversation(rag_conversation);
      console.log('inserting single rag result in loop');
    }

  }

  // Step 5: Append user prompt to conversation
  const user_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
        role: 'user',
        removed_flag: 'IN',
        content: userPrompt
  };
  let estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
  user_conversation.token_count = user_conversation.content ? estimateTokens(user_conversation.content) : 0;
  arrConversations.push(user_conversation);
  await this.chatRepository.insertConversation(user_conversation);

  // step 5.1 if this is the testuser account then call the repo layer to fill 
  // 7 is jackthecat@gmail.com
//if (recAuthtoken.user_id === 7) {
    // this repo function will fill in the covert session info to inject
if (fullContext) {
    const arrRoleConversations = await this.chatRepository.getRoleConversations(recAuthtoken.user_id);
    console.log ('full context requested so injecting knowledge sessions ');    
    if (arrRoleConversations.length > 0) {
    //    console.log(`Prepending ${arrRoleConversations.length} covert conversation records.`);
        arrConversations.unshift(...arrRoleConversations); // ✅ Prepend covert sessions
    }
}
else
{    console.log ('NOT injecting knowledge sessions ');    
}

  // Step 6: Prepare input for LLM, arrConversations matches the table ddl not what the llm json expects
  const llm_messages = arrConversations.map(conv => ({
    role: conv.role,  // Directly use role as it is
    content: conv.content
  }));

  // Step 7: Send request to LLM (the correct one)
  let response; 

  if (recUsers.active_model === 'gemini_freetier') {
    const geminiApiKey = "AIzaSyCutGkPZd2E-42v9hcrzzzvVlATEX9jFy8";
    // const modelName = 'gemini-2.0-pro-exp-02-05';
    // const modelName = 'gemini-2.0-flash';
    const modelName = 'gemini-2.5-pro-exp-03-25';

    try 
    {
      const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      // Adapt `llm_messages` for Gemini's expected format
      let geminiContents: GeminiContentItem[] = [];
      let accumulatedContext = ""; // Store context from RAG/SNOW/UPL AND system messages

      for (let i = 0; i < llm_messages.length; i++) {
        const message = llm_messages[i];
        let role = 'user';
        if (message.role === 'assistant') {
          role = 'model';
        }
        if (message.role === 'system' || message.role.startsWith('rag_') || message.role.startsWith('snow_') || message.role === 'upl data') {
          accumulatedContext += "\n" + message.role + ": " + message.content;
          continue; // Accumulate context and skip adding this message to geminiContents directly
        }
        // Add the main message to geminiContents
        let messageContent = message.content;
        if (accumulatedContext !== "") {
          //messageContent = messageContent + "\n\nContext:" + accumulatedContext;
          messageContent = "Context:" + accumulatedContext + "\n\n Question: " + messageContent;

          accumulatedContext = ""; // Reset context
        }
        geminiContents.push({
          parts: [{ text: messageContent }],
          role: role
        });
      }
      //console.log('ServiceLayer step 7 - normalized geminiContents ', geminiContents);

      geminiContents = geminiContents.filter(entry =>
      entry.parts?.some(part => part.text && part.text.trim() !== "")
      );

//      console.log('geminiContents:', JSON.stringify(geminiContents, null, 2));

      const requestPayload = {
      contents: geminiContents,
      generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.85,
      topP: 0.9,
      topK: 50,
      }
      };

      response = await fetch(geminiApiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorBody = await response.text(); // or use .json() if you expect JSON
        console.error("Gemini API Error Response Body:", errorBody);
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      if (!responseData || !responseData.candidates || responseData.candidates.length === 0) {
        throw new Error("Gemini API returned an empty response.");
      }

      // 🔹 Extract the assistant's message
      const assistantMessage = responseData.candidates[0]?.content?.parts?.[0]?.text || "";

      if (assistantMessage) {
        yield assistantMessage; // Send this as a single response
      }

      const llm_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
        role: 'assistant',
        removed_flag: 'IN',
        content: assistantMessage, // ✅ Store full streamed response
      };

      llm_conversation.token_count = llm_conversation.content ? estimateTokens(llm_conversation.content) : 0;

      await this.chatRepository.insertConversation(llm_conversation);
      // .. now we need to complete stop this function call because the rest is for chatgpt  and localllama only...
//      console.error("early return from gemini function - all good");
      return;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error;
    }
  }

  // if we are still here then we must be NOT the prior model as that has a return to get the heck out.
  if (recUsers.active_model === 'local_8B')
  {
    //  console.log('ServiceLayer step 7 - sending this to local LLM');
    // local stuff is going through lm studio which uses the openai standard for their api 
    // that is, in openai standard all non-standard roles need to be mapped over to system
    normalizedMessages = arrConversations.map(msg => {
      if (['system', 'user', 'assistant'].includes(msg.role))
      return {
        role: msg.role,
        content: msg.content
      };
      // Handle special roles like rag_data or others with filenames
      let prefix = `[${msg.role.toUpperCase()}]`;
      let sourceInfo = '';
      if (msg.role === 'rag_data' && msg.rag_filename) {
        sourceInfo = ` (Source: ${msg.rag_filename}${msg.rag_chunk_id != null ? ` [chunk ${msg.rag_chunk_id}]` : ''})`;
      } else if (msg.role.includes('upl') && msg.upl_filename) {
        sourceInfo = ` (Source: ${msg.upl_filename})`;
      }
      return {
        role: 'system',
        content: `${prefix}${sourceInfo} ${msg.content}`
      };
    });
    //  console.log('ServiceLayer step 7 - normalizedMessages: ', normalizedMessages);

    const requestPayload = {
    //      model: "deepseek-r1-distill-qwen-7b",
    model: "llama4-dolphin-8b",
    messages: normalizedMessages,
    max_tokens: 4096,
    stream: true,  // Enable streaming
    };

    response = await fetch("http://localhost:8082/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
    });
  }

    // if we are still here then we must be NOT the prior model as that has a return to get the heck out.
  else if (recUsers.active_model === 'openrouter')
  {
    console.log('ServiceLayer openrouter ');

    normalizedMessages = arrConversations.map(msg => {
      if (['system', 'user', 'assistant'].includes(msg.role))
      return {
        role: msg.role,
        content: msg.content
      };
      // Handle special roles like rag_data or others with filenames
      let prefix = `[${msg.role.toUpperCase()}]`;
      let sourceInfo = '';
      if (msg.role === 'rag_data' && msg.rag_filename) {
        sourceInfo = ` (Source: ${msg.rag_filename}${msg.rag_chunk_id != null ? ` [chunk ${msg.rag_chunk_id}]` : ''})`;
      } else if (msg.role.includes('upl') && msg.upl_filename) {
        sourceInfo = ` (Source: ${msg.upl_filename})`;
      }
      return {
        role: 'system',
        content: `${prefix}${sourceInfo} ${msg.content}`
      };
    });

    const requestPayload = {
    model: "deepseek/deepseek-chat:free",  // or any other OpenRouter model ID
    messages: normalizedMessages,
    max_tokens: 4096,
    stream: true
    };

    console.log("Request payload:", JSON.stringify(requestPayload, null, 2));

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
    "Authorization": `Bearer ${openrouterKey}`,
    "HTTP-Referer": "https://sensitivedata.ca",
    "Content-Type": "application/json"
    },
    body: JSON.stringify(requestPayload),
    });

  }

  else if (recUsers.active_model === 'openai_4_mini')
  {
    //  console.log('ServiceLayer step 7 - sending this to openaimini LLM');
    normalizedMessages = arrConversations.map(msg => {
      if (['system', 'user', 'assistant'].includes(msg.role))
      return {
        role: msg.role,
        content: msg.content
      };
      // Handle special roles like rag_data or others with filenames
      let prefix = `[${msg.role.toUpperCase()}]`;
      let sourceInfo = '';

      if (msg.role === 'rag_data' && msg.rag_filename) {
        sourceInfo = ` (Source: ${msg.rag_filename}${msg.rag_chunk_id != null ? ` [chunk ${msg.rag_chunk_id}]` : ''})`;
      } else if (msg.role.includes('upl') && msg.upl_filename) {
        sourceInfo = ` (Source: ${msg.upl_filename})`;
      }
      return {
        role: 'system',
        content: `${prefix}${sourceInfo} ${msg.content}`
      };
    });
    //  console.log('ServiceLayer step 7 - normalizedMessages: ', normalizedMessages);
    //  model: "gpt-4o-mini-2024-07-18",   
    const requestPayload = {
    model: "gpt-4o",
    messages: normalizedMessages,
    max_tokens: 4096,
    stream: true,  // Enable streaming
    };

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(requestPayload),
    });
  }

  else {
    console.error("❌ Invalid active_model:", recUsers.active_model);
    return; // ✅ Exit early if no valid model is selected
  }

  // this is the common streaming code
  if (!response.ok) {
    console.error("HTTP Error:", response.status);

  if (response.status === 429) {
    console.error("Rate limit details:");
    console.error("x-ratelimit-limit-requests:", response.headers.get("x-ratelimit-limit-requests"));
    console.error("x-ratelimit-remaining-requests:", response.headers.get("x-ratelimit-remaining-requests"));
    console.error("x-ratelimit-limit-tokens:", response.headers.get("x-ratelimit-limit-tokens"));
    console.error("x-ratelimit-remaining-tokens:", response.headers.get("x-ratelimit-remaining-tokens"));
    console.error("retry-after (seconds):", response.headers.get("retry-after"));
  }

    return; // Handle error gracefully
  }

  // Ensure response.body is not null
  if (!response.body) {
    throw new Error('Response body is null');
  }

//    const decoder = new TextDecoder("utf-8");
//    let buffer = "";  // Buffer to hold chunks
    let accumulatedContent = "";  // To accumulate the full response

    // Process the stream

const reader = response.body.getReader();
const decoder = new TextDecoder("utf-8");
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n");
  buffer = lines.pop() ?? ""; // Save incomplete line

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;

    const jsonString = line.slice(6).trim();
    if (jsonString === "[DONE]") break;

    try {
      const parsed = JSON.parse(jsonString);
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) {
        accumulatedContent += content;
        yield content;
        //console.log('🟢 Streaming token to frontend:', content);

      }
    } catch (err) {
      console.error("JSON Parse Error:", err.message, jsonString);
      throw err;
    }
  }
}

// console.log('ServiceLayer step 8 - Streaming complete.');

const llm_conversation: Conversations = {
        session_id: recUsers.active_session_id,
        user_id: recUsers.user_id,
  role: 'assistant',
        removed_flag: 'IN',
  content: accumulatedContent, // ✅ Store full streamed response
};

      llm_conversation.token_count = llm_conversation.content ? estimateTokens(llm_conversation.content) : 0;

await this.chatRepository.insertConversation(llm_conversation);
}


//
// validateAuthToken() used as a local function first step
//
private async validateAuthToken(token: string): Promise<auth_tokens> 
{
  //console.log('servicelayer validateAuthToken: start');
  let recAuthtoken: auth_tokens | null;

  try 
  {
    // console.log('servicelayer validateAuthToken: verifying JWT - input token:', token);
    jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });

    recAuthtoken = await this.chatRepository.findauthtokenbyjwt(token);
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


async getUserRoles(token: string): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const arr: view_user_roles[] = await this.chatRepository.getUserRoles(recAuthtoken.user_id);
//  console.log(' servicelayer: sql returned', JSON.stringify(arr));
  return { message: JSON.stringify(arr) };
}


async getSessionById(token: string, sessionId: number): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const session = await this.chatRepository.getSessionById(sessionId);

    if (session.session_owner_user_id !== recAuthtoken.user_id)
    {
        console.error('service layer: error cannot retrieve someone elses session record');
        throw new BadRequestException("Session select session failed-invalid ownership.");
    }

  return { message: JSON.stringify(session) };
}


async updateSession(
  token: string,
  sessionId: number,
  body: { session_desc: string; session_type?: string; role_id?: number }
): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  await this.chatRepository.updateSession(sessionId, recAuthtoken.user_id, body);
  return { message: 'Update successful' };
}

async createSession(
  token: string,
  body: { session_desc: string; session_type?: string; role_id?: number }
): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  await this.chatRepository.createSession(recAuthtoken.user_id, body);
  return { message: 'Session created successfully' };
}

// new stuff
async getAllRoles(token: string): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const arr = await this.chatRepository.getAllRoles();
  return { message: JSON.stringify(arr) };
}

async getAllRoleSessions(token: string): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const arr = await this.chatRepository.getAllRoleSessions();
  return { message: JSON.stringify(arr) };
}


async doAddUserRoleSession(token: string, session_id: number): Promise<{ message: string }> {
  const authToken = await this.validateAuthToken(token);
  const user_id = authToken.user_id;

  const nextSeq = await this.chatRepository.getNextUserRoleSessionSeq(user_id);
  await this.chatRepository.insertUserRoleSession(user_id, session_id, nextSeq);

  return { message: `Session ${session_id} added to user_rolesessions with seq ${nextSeq}` };
}

async doRemoveUserRoleSession(token: string, session_id: number): Promise<{ message: string }> {
  const authToken = await this.validateAuthToken(token);
  const user_id = authToken.user_id;

  await this.chatRepository.deleteUserRoleSession(user_id, session_id);

  return { message: `Session ${session_id} removed from user_rolesessions` };
}

async getQuickPrompts(token: string): Promise<{ message: string }> {
  const recAuthtoken = await this.validateAuthToken(token);
  const arr = await this.chatRepository.getQuickPrompts(); // assumes repository method exists
  return { message: JSON.stringify(arr) };
}


// new
/*
async createCreativeResponse(token: string, prompt: string): Promise<{ message: string }> {
  await this.validateAuthToken(token);

  const demoSubreply = [
    { subreply_type: "addNewConvRecord" },
    { subreply_type: "updateOldConvRecord", id: 123 },
    { subreply_type: "deleteConvRecord",    id: 456 },
    { subreply_type: "fetchUrl",            url: "https://example.com" }
  ];

  return { message: JSON.stringify(demoSubreply) };   // <-- MUST be array JSON
}
*/


async createCreativeResponse(token: string, userPrompt: string): Promise<{ message: string }> {
  // STEP 0: Auth and user retrieval
  const recAuthtoken = await this.validateAuthToken(token);
  const user_id = recAuthtoken.user_id;
  const recUsers = await this.chatRepository.getUser(user_id);
  const session_id = recUsers.active_session_id;

  // STEP 1: Get conversation history
  const arrConversations: Conversations[] = await this.chatRepository.getActiveConversations(session_id);

  // STEP 2: Covertly append system record (ie onto array but NOT in the db)
    const beliefSeed = ' seedbelief value start: ' + recUsers.seedbelief + 'end of seedbelief ';
  const systemMessage = beliefSeed + getSystemJsonFormatMessage();
  const recSystemconversation: Conversations = {
        session_id: session_id,
        user_id: user_id,
        role: 'system',
        removed_flag: 'IN',
        content: systemMessage,
  }; 
  arrConversations.unshift(recSystemconversation);

  // STEP 3: Insert original userPrompt into DB but not array
  const recUserConv: Conversations = {
       session_id: session_id,
       user_id: user_id,
       role: 'user',
       removed_flag: 'IN',
       content: userPrompt
  };
  const estimateTokens = (text: string): number => {return Math.ceil(text.split(/\s+/).length * 1.3);       };
  recUserConv.token_count = recUserConv.content ? estimateTokens(recUserConv.content) : 0;
  await this.chatRepository.insertConversation(recUserConv);

  // STEP 4: concatonate Belief and Goal to user message
  const userCommands = getUserCommands();
  let expandedUserPrompt = userPrompt + userCommands;

  //console.log('service: expandedUserPrompt ' + expandedUserPrompt);

  // STEP 5: check if its needs a Cleanup
  const used_tokens = await this.chatRepository.getSessionTokenCount(session_id);
  console.log('🔍 service createCreativeResponse: used_tokens: \n' + used_tokens);
  if (used_tokens > 15000) {
    let cleanup = getcleanupMessage()
    expandedUserPrompt = userPrompt + " You have used " + used_tokens + " but for the orchestrator to function properly you need to get under 10000. " + cleanup;
      console.log('🔍 service createCreativeResponse: REMINDER SENT \n');
  }

  // STEP 6: now that expandeduserprompt is ready, lets insert THIS into array
  recUserConv.content = expandedUserPrompt;
  arrConversations.push(recUserConv);

  // STEP 7: Convert to LLM API format (stubbed)
  if (!recUsers.active_model) {
    throw new Error("active_model is undefined");
  }
  const llmMessages = transform_for_activemodel(arrConversations, recUsers.active_model);
 // console.log('🔍 service createCreativeResponse: calling the llm with llmMessages:\n' + JSON.stringify(llmMessages, null, 2));

  // STEP 8: Call active model (stubbed)
  const { raw, content } = await call_activemodel(llmMessages, recUsers.active_model);
  //console.log('seca service LLM Response Content:', content);
  //console.log("OpenAI raw:", JSON.stringify(raw, null, 2));


  // STEP 9: Parse and validate
  const subreplies = parseSubreplies(content);
  console.log("completed parsesubreplies")
 // validateSubreplies(subreplies);
 // console.log("completed validatesubreplies")

 // STEP 9b: Add meta-summary subreply listing all actions (types + IDs if present)
// STEP 9b: Inject meta-summary subreply
const summaryLines: string[] = [];

subreplies.forEach((sub, index) => {
  const num = index + 1;
  const type = sub.subreply_type;
  let detail = '';

  if (type === 'updateOldConvRecord' || type === 'deleteConvRecord') {
    detail = ` on ID ${sub.id}`;
  }

  summaryLines.push(`#${num}: ${type}${detail}`);
});

const summaryText = `[meta] Summary of subreply actions:\n${summaryLines.join('\n')}`;

const metaSubreply = {
  subreply_type: 'addNewConvRecord',
  new_content: summaryText
};

// subreplies.push(metaSubreply);

  // STEP 10: Apply
  await applySubreplies(this.chatRepository, subreplies, session_id, user_id);
  console.log("completed applysubreplies")
  
  return { message: JSON.stringify(subreplies) };
}



}



