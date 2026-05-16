import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { format } from 'date-fns';
import { Conversations, updateConversations, auth_tokens, Users, viewUsers, updateUsers, Sessions, view_sessions } from './interfaces';
import { view_user_roles, view_available_rolesessions, view_enabled_rolesessions, QuickPrompts } from './interfaces';
import weaviate from "weaviate-ts-client";
import fetch from "node-fetch";

const LLM_SERVER_URL = "http://localhost:8082/v1/chat/completions";
const WEAVIATE_HOST = "http://localhost:8080";
const MODEL_NAME = "local-llama-model";
const TOP_K = 1;
const MAX_TOKENS = 500;
const TEMPERATURE = 0;
const TOP_P = 0;

@Injectable()
export class ChatRepository 
{
  private weaviateClient;

  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) 
  {
    this.weaviateClient = weaviate.client(
    {
      scheme: "http",
      host: WEAVIATE_HOST,
    });
  }


  async getviewUser(userId: number): Promise<viewUsers> {
//    console.log('RepoLayer getviewUser start');

    const query = `
      SELECT *
      FROM viewUsers
      WHERE user_id = ?;
    `;

    const [results] = await this.db.execute(query, [userId]);

    if (!results || (results as any[]).length === 0) {
      console.error(`RepoLayer getviewUser: No user found for user_id ${userId}`);
      throw new Error(`No user found for user_id ${userId}`);
    }

    return results[0] as viewUsers;
  }


  async updateUserActiveModel(userId: number, activeModel: 'local_8B' | 'openai_4_mini'): Promise<void> {
    const query = `UPDATE users SET active_model = ? WHERE user_id = ?;`;
    await this.db.execute(query, [activeModel, userId]);
  }

  async updateUsers(recUser: updateUsers): Promise<void> {
  //  console.log('RepoLayer updateUsers start');

    const query = `
      Update users
      SET active_session_id = ?
      WHERE user_id = ?;
    `;

    await this.db.execute(query, [
      recUser.active_session_id,
      recUser.user_id
    ]);
  }


  async deleteConversations(conversation_id: number): Promise<void> {
  //  console.log('RepoLayer deleteConversations start');

    const query = `
      DELETE from conversations 
      WHERE conversation_id = ?;
    `;

    await this.db.execute(query, [
conversation_id
    ]);
  }





  async deleteSessions(session_id: number): Promise<void> {
  //  console.log('RepoLayer deleteSessions start');

    const query = `
      DELETE from sessions 
      WHERE session_id = ?;
    `;

    await this.db.execute(query, [
session_id
    ]);
  }




async InsertSession(userId: number, sessionDesc: string): Promise<number> {
//  console.log('RepoLayer InsertSession start');

  const query = `
    INSERT INTO sessions (session_owner_user_id, session_desc)
    VALUES (?, ?);
  `;

  const [result] = await this.db.execute(query, [userId, sessionDesc]);

  // ✅ Extract the newly inserted session_id (AUTO_INCREMENT)
  return (result as any).insertId;
}

// this is legacy code to be deleted
// this is legacy code to be deleted
// this is legacy code to be deleted
async cloneConversations(oldSessionId: number, newSessionId: number, newUserId: number): Promise<void> {
 // console.log("RepoLayer cloneConversations start");

  const selectQuery = `
    SELECT *
    FROM conversations
    WHERE session_id = ?;
  `;

  const [conversations] = await this.db.execute(selectQuery, [oldSessionId]);

  if (!Array.isArray(conversations) || conversations.length === 0) {
    console.log("⚠️ RepoLayer cloneConversations: No conversations found to clone.");
    return;
  }

  const insertQuery = `
    INSERT INTO conversations (
      session_id, user_id, role, content, removed_flag, 
      api_keywords, snow_sys_id, rag_filename, rag_chunk_id, rag_tags, upl_filename
    ) VALUES ?;
  `;

  const insertValues = (conversations as any[]).map(conv => [
    newSessionId, newUserId, conv.role, conv.content, conv.removed_flag,
    conv.api_keywords, conv.snow_sys_id, conv.rag_filename, conv.rag_chunk_id, conv.rag_tags, conv.upl_filename
  ]);

  await this.db.query(insertQuery, [insertValues]);

//  console.log(`✅ RepoLayer cloneConversations: ${insertValues.length} conversations cloned successfully.`);
}



async updateUserActiveSession(userId: number, sessionId: number): Promise<void> {
//  console.log("🔍 Repo Layer: updateUserActiveSession start");

  const query = `
    UPDATE users
    SET active_session_id = ?
    WHERE user_id = ?;
  `;

  await this.db.execute(query, [sessionId, userId]);

//  console.log("✅ Repo Layer: User active session updated.");
}



async updateConversations(recupdateConversations: updateConversations): Promise<void> {
 //   console.log('RepoLayer updateConversations start');

    const query = `
      Update conversations
      SET removed_flag = ?
      WHERE conversation_id = ?;
    `;

    await this.db.execute(query, [
      recupdateConversations.removed_flag,
      recupdateConversations.conversation_id
    ]);
  }



// old code no longer used but left for historical purposes
async updateSessionDescription(userId: number, sessionId: number, session_desc: string): Promise<void> {
 // console.log('RepoLayer updateSessionDescription start');

  const query = `
    UPDATE sessions
    SET session_desc = ?, updated_dttm = CURRENT_TIMESTAMP
    WHERE session_id = ? AND session_owner_user_id = ?;
  `;

  await this.db.execute(query, [session_desc, sessionId, userId]);
}


async getSessionsByUserId(userId: number): Promise<Sessions[]> {
  //  console.log('RepoLayer getSessionsByUserId start');

    const query = `
      SELECT *
      FROM view_sessions
      WHERE session_owner_user_id = ?;
    `;

    const [results] = await this.db.execute(query, [userId]);

    return results as view_sessions[];
}


async getUser(userId: number): Promise<Users> {
  //  console.log('RepoLayer getUser start');

    const query = `
      SELECT *
      FROM users
      WHERE user_id = ?;
    `;

    const [results] = await this.db.execute(query, [userId]);

    if (!results || (results as any[]).length === 0) {
      console.error(`RepoLayer getUser: No user found for user_id ${userId}`);
      throw new Error(`No user found for user_id ${userId}`);
    }

    return results[0] as Users;
  }


//
//
//
async fetchCitations(session_id: number): Promise<any[]> {
 // console.log("🔍 Repo Layer: fetchCitations start");

    const query = `SELECT * FROM conversations WHERE session_id = ? AND role = 'rag_data' ORDER BY created_dttm ASC;`;
    const [results] = await this.db.execute(query, [session_id]);
    return results as Conversations[];
}

async getAllUsersExcept(currentUserId: number): Promise<Users[]> {
 // console.log("🔍 Repo Layer: getAllUsersExcept start");

  const query = `
    SELECT * 
    FROM users 
    WHERE user_id <> ? 
    ORDER BY last_nm ASC;
  `;

  const [results] = await this.db.execute(query, [currentUserId]) as [Users[], any];

  return results || []; // Ensure an empty array if no results
}


//
//
//
async ConversationCount(session_id: number): Promise<number> {
//  console.log("🔍 Repo Layer: ConversationCount start");

    const query = `SELECT count(*) as ConvCount FROM conversations WHERE session_id = ?;`;

  const [results] = await this.db.execute(query, [session_id]);
  const rows = results as any[];
  return rows[0].ConvCount;

}


//
//
// deleteConversation
//
//
  async deleteConversation(session_id: number): Promise<void> {
  //  console.log('RepoLayer deleteConversation start');

    const query = `
      delete from conversations where session_id = ?;
    `;

    await this.db.execute(query, [session_id]);

  }


//
//
// getRemovedConversations
//
//
  async getRemovedConversations(session_id: number): Promise<Conversations[]> {
    const query = `SELECT * FROM conversations WHERE session_id = ? ORDER BY created_dttm ASC;`;
    const [results] = await this.db.execute(query, [session_id]);
    return results as Conversations[];
  }

  async getActiveConversations(session_id: number): Promise<Conversations[]> {
    const query = `SELECT * FROM conversations WHERE session_id = ? AND removed_flag = 'IN' ORDER BY created_dttm ASC;`;
    const [results] = await this.db.execute(query, [session_id]);
    return results as Conversations[];
  }



//
//
// insertConversation
//
//
async insertConversation(conversation: Conversations): Promise<void> {
  //  console.log('RepoLayer insertConversation start');

    // ✅ Token Estimation Function
    //const estimateTokens = (text: string): number => {
    //    return Math.ceil(text.split(/\s+/).length * 1.3); // Approximate token estimation
    //};

    // ✅ Compute token count before inserting into DB
    //const tokenCount = conversation.content ? estimateTokens(conversation.content) : 0;

    const query = `
      INSERT INTO conversations (
        session_id, user_id, role, content, api_keywords, snow_sys_id, 
        rag_filename, rag_chunk_id, rag_tags, upl_filename, token_count
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await this.db.execute(query, [
        conversation.session_id,
        conversation.user_id,
        conversation.role,
        conversation.content,
        conversation.api_keywords ?? null,
        conversation.snow_sys_id ?? null,
        conversation.rag_filename ?? null,
        conversation.rag_chunk_id ?? null,
        conversation.rag_tags ?? null,
        conversation.upl_filename ?? null,
        conversation.token_count ?? null
    ]);

    //console.log(`✅ RepoLayer insertConversation: Inserted with ${tokenCount} tokens.`);
}



async appendToActiveSession(activeSessionId: number, sessionIdToAppend: number): Promise<void> {
//  console.log("RepoLayer appendToActiveSession start");

  // Step 1: Fetch all conversations from the session being appended FROM
  const selectQuery = `
    SELECT user_id, role, content, removed_flag, api_keywords, snow_sys_id, rag_filename, rag_chunk_id, rag_tags, upl_filename
    FROM conversations
    WHERE session_id = ?;
  `;
  const [conversations] = await this.db.execute(selectQuery, [sessionIdToAppend]);

  if (!Array.isArray(conversations) || conversations.length === 0) {
    console.log("⚠️ RepoLayer appendToActiveSession: No conversations found to append.");
    return;
  }

  // Step 2: Insert all fetched records into the active session (excluding created_dttm to let DB handle timestamps)
  const insertQuery = `
    INSERT INTO conversations (
      session_id, user_id, role, content, removed_flag, 
      api_keywords, snow_sys_id, rag_filename, rag_chunk_id, rag_tags, upl_filename
    ) VALUES ?;
  `;

  const insertValues = (conversations as any[]).map(conv => [
    activeSessionId, conv.user_id, conv.role, conv.content, conv.removed_flag,
    conv.api_keywords, conv.snow_sys_id, conv.rag_filename, conv.rag_chunk_id, conv.rag_tags, conv.upl_filename
  ]);

  await this.db.query(insertQuery, [insertValues]);

//  console.log(`✅ RepoLayer appendToActiveSession: ${insertValues.length} conversations appended successfully.`);
}


//
//
// fetchRagConversations
// 
//   .withClassName("EnterpriseDocumentChunk")

async fetchRag_v_Conversations(query: string, session_id: number, userId: number, topK: number, confidence: number,
  veri_status: 'Verified' | 'Unverified'
): Promise<Conversations[]> {
//  console.log('RepoLayer fetchRagvConversations start with topK ' ,topK);
//  console.log('RepoLayer fetchRagvConversations start with confidence ' ,confidence);
//  console.log('RepoLayer fetchRagvConversations start with veri_status ' ,veri_status);

  try {
    // Step 1: Query Weaviate for RAG chunks
const response = await this.weaviateClient.graphql
  .get()
  .withClassName("EnterpriseDocumentChunk")
  .withFields("filename chunk_id text tags _additional { score }")
  .withHybrid({ query, alpha: 0.2 })
  .withWhere({
    operator: "Equal",
    path: ["verification_status"],
    valueText: veri_status
  })
  .withLimit(topK)
  .do();

// console.log("Scores:", response.data.Get.EnterpriseDocumentChunk.map(c => c._additional?.score));

const rawChunks = (response.data.Get.EnterpriseDocumentChunk || []).filter(
  (chunk) => Number(chunk._additional?.score) >= confidence
);

    // Step 2: Handle No Results
    if (rawChunks.length === 0) {
      console.log("RepoLayer fetchRagvConversations: No relevant chunks found.");
      return [];
    }

  //  console.log(`RepoLayer fetchRagvConversations: Retrieved ${rawChunks.length} RAG records.`);

// Step 2.5: Fetch existing rag_data keys for deduplication
const [existingRows] = await this.db.execute(
  'SELECT rag_filename, rag_chunk_id FROM conversations WHERE session_id = ? AND role = \'rag_data\'',
  [session_id]
);

const existingKeys = new Set(
  (existingRows as any[]).map(r => `${r.rag_filename}::${r.rag_chunk_id}`)
);

// Step 2.6: Filter out already-inserted records
const newChunks = rawChunks.filter(chunk => {
  const key = `${chunk.filename}::${chunk.chunk_id}`;
  return !existingKeys.has(key);
});

    // Step 3: Convert raw chunks into Conversations format
    const arrRagConversations: Conversations[] = newChunks.map((chunk: any) => {
      return {
        session_id: session_id,
        user_id: userId,
        role: "rag_data",
        content: chunk.text,
        rag_filename: chunk.filename,
        rag_chunk_id: chunk.chunk_id,
        rag_tags: JSON.stringify({
          ...(chunk.tags || {}),
          score: Number(chunk._additional?.score)
        })

        //rag_tags: JSON.stringify(chunk.tags || [])
      };
    });

  //  console.log(`RepoLayer fetchRagvConversations: Processed ${arrRagConversations.length} RAG chunks.`);
    return arrRagConversations;
  } catch (error) {
    console.error('RepoLayer fetchRagvConversations: Error processing RAG:', error);
    throw new Error('Failed to process RAG data');
  }
}



async getRoleConversations(userId: number): Promise<Conversations[]> {
//  console.log("🔍 RepoLayer: getRoleConversations start");

  const arrConversations: Conversations[] = [];

  // Step 1: Get all injected session_ids in order
  const sessionQuery = `
    SELECT session_id 
    FROM user_rolesessions 
    WHERE user_id = ? 
    ORDER BY seq ASC;
  `;
  const [sessionRows] = await this.db.execute(sessionQuery, [userId]);
  const sessionIds = (sessionRows as any[]).map(row => row.session_id);

  // Step 2: For each session, fetch all 'IN' conversations and accumulate
  for (const sessionId of sessionIds) {
    const convoQuery = `
      SELECT * 
      FROM conversations 
      WHERE session_id = ? AND removed_flag = 'IN'
      ORDER BY created_dttm ASC;
    `;
    const [convoRows] = await this.db.execute(convoQuery, [sessionId]);
    arrConversations.push(...(convoRows as Conversations[]));
  }

  console.log(`✅ RepoLayer: getRoleConversations returning ${arrConversations.length} total records`);
  return arrConversations;
}




async getSessionTokenCount(session_id: number): Promise<number> {
//  console.log("🔍 Repo Layer: getSessionTokenCount start");

  const query = `SELECT SUM(token_count) AS totalTokens FROM conversations WHERE session_id = ?;`;

  const [results] = await this.db.execute(query, [session_id]);
  const stats = results as any[];

  return stats[0].totalTokens || 0;
}

async getAvailableRoleSessions(user_id: number): Promise<view_available_rolesessions[]> {
  const query = `SELECT * FROM view_available_rolesessions WHERE user_id = ? ORDER BY role_desc`;
  const [results] = await this.db.execute(query, [user_id]);
  return results as view_available_rolesessions[];
}

async getEnabledRoleSessions(user_id: number): Promise<view_enabled_rolesessions[]> {
  const query = `SELECT * FROM view_enabled_rolesessions WHERE user_id = ? ORDER BY seq ASC`;
  const [results] = await this.db.execute(query, [user_id]);
  return results as view_enabled_rolesessions[];
}



//
//
// findauthtokenbyjwt
//
//
async findauthtokenbyjwt(token: string): Promise<auth_tokens | null> 
{
//  console.log('repolayer findauthtokenbyjwt start');
  const query = `
    SELECT *
    FROM auth_tokens
    WHERE jwt_token = ?;
  `;
  try {
    // console.log('The token inputted is:', token);

    // Query the database
    const [results] = await this.db.execute(query, [token]);

    //console.log('repolayer - Query results:', results);

    // Check if no results are returned
    if (!results || (results as any[]).length === 0) {
      console.log('repolyr no auth_token records found');
      return null;
    }

    // Extract the first record
    const authtokenRec = results[0] as auth_tokens; // Typecast here after validation

    //console.log('repolayer - Found JWT with user_id:', authtokenRec.user_id);
    //console.log('repolayer - Found JWT with expires_at:', authtokenRec.expires_at);

    // Check expiration date
    if (new Date(authtokenRec.expires_at) <= new Date()) {
      console.error('JWT has expired.');
      throw new Error(' Found token however... Token has expired');
    }

//    console.log('repolayer validatetoken end');
    return authtokenRec; // Return the single record
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Failed to validate token in database');
  }
}

async getUserRoles(user_id: number): Promise<view_user_roles[]> {
  const sql = `SELECT * FROM view_user_roles WHERE user_id = ?`;
  const [rows] = await this.db.execute(sql, [user_id]);
  return rows as view_user_roles[];
}

async getSessionById(sessionId: number): Promise<view_sessions> {
  const sql = `SELECT * FROM view_sessions WHERE session_id = ?`;
  const [rows] = await this.db.execute(sql, [sessionId]);
  return rows[0] as view_sessions;
}

async updateSession(
  sessionId: number,
  user_id: number,
  body: { session_desc: string; session_type?: string; role_id?: number }
): Promise<void> {
  const sql = `
    UPDATE sessions
    SET session_desc = ?, session_type = ?, role_id = ?, updated_dttm = CURRENT_TIMESTAMP
    WHERE session_id = ? AND session_owner_user_id = ?
  `;
  const params = [body.session_desc, body.session_type || null, body.role_id || null, sessionId, user_id];

//  console.log ('repo layer, updatesession: params is ', params)

  await this.db.execute(sql, params);

}

async createSession(
  user_id: number,
  body: { session_desc: string; session_type?: string; role_id?: number }
): Promise<void> {
  const sql = `
    INSERT INTO sessions (session_owner_user_id, session_desc, session_type, role_id, created_dttm, updated_dttm)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  const params = [
    user_id,
    body.session_desc,
    body.session_type || null,
    body.role_id || null
  ];

  await this.db.execute(sql, params);
}


// new stuff
async getAllRoles(): Promise<view_user_roles[]> {
  const sql = `SELECT * FROM roles ORDER BY role_desc`;
  const [rows] = await this.db.execute(sql);
  return rows as view_user_roles[];
}

async getAllRoleSessions(): Promise<view_available_rolesessions[]> {
  const sql = `SELECT * FROM view_all_knowledgesessions ORDER BY session_desc`;
  const [rows] = await this.db.execute(sql);
  return rows as view_available_rolesessions[];
}

// new

async getNextUserRoleSessionSeq(user_id: number): Promise<number> {
  const [rows] = await this.db.query(`SELECT MAX(seq) AS max_seq FROM user_rolesessions WHERE user_id = ?`, [user_id]);
  const max = (rows as any)[0]?.max_seq ?? 0;
  return max + 1;
}


async insertUserRoleSession(user_id: number, session_id: number, seq: number): Promise<void> {
  await this.db.query(
    `INSERT INTO user_rolesessions (user_id, session_id, seq) VALUES (?, ?, ?)`,
    [user_id, session_id, seq]
  );
}

async deleteUserRoleSession(user_id: number, session_id: number): Promise<void> {
  await this.db.query(
    `DELETE FROM user_rolesessions WHERE user_id = ? AND session_id = ?`,
    [user_id, session_id]
  );
}

 
async getQuickPrompts(): Promise<QuickPrompts[]> {
  const sql = `SELECT * FROM quickprompts ORDER BY label`;
  const [rows] = await this.db.execute(sql);
  return rows as QuickPrompts[];
}


async updateConversationContent(conversation_id: number, new_content: string): Promise<void> {
  const query = `
    UPDATE conversations
    SET content = ?
    WHERE conversation_id = ?;
  `;

  const [result] = await this.db.execute(query, [new_content, conversation_id]);
if ((result as any).affectedRows === 0) {
  console.warn(`repo layer updateConversationContent: No conversation found with ID ${conversation_id}`);
}


  //await this.db.execute(query, [new_content, conversation_id]);
}

async updateSeedbelief(user_id: number, seed: string): Promise<void> {
  const sql = `UPDATE users SET seedbelief = ? WHERE user_id = ?`;
  await this.db.execute(sql, [seed, user_id]);
}


async runPlayspaceSql(sql: string): Promise<any> {
  // single call; returns rows for SELECT, OkPacket for others
  const [rows] = await this.db.query(sql);
  return rows;
}



}
