import { Injectable, Inject } from '@nestjs/common';
import { PgDatabase } from '../database';
import { format } from 'date-fns';
import { Conversations, updateConversations, auth_tokens, Users, viewUsers, updateUsers, Sessions, view_sessions, CreativeSubconsciousDrive, CreativeSubconsciousRun, CreativeRelationship, CreativeBelief } from './interfaces';
import { view_user_roles, view_available_rolesessions, view_enabled_rolesessions, QuickPrompts } from './interfaces';
import weaviate from "weaviate-ts-client";
import fetch from "node-fetch";
import { config } from '../config';

const LLM_SERVER_URL = config.llm.localUrl;
const WEAVIATE_URL = new URL(config.weaviate.url);
const MODEL_NAME = "local-llama-model";
const TOP_K = 1;
const MAX_TOKENS = 500;
const TEMPERATURE = 0;
const TOP_P = 0;
const SECA_ARCHIVED_CONVERSATION_CLASS = 'SecaArchivedConversation';
const SECA_CURATED_MEMORY_CLASS = 'SecaCuratedMemory';

interface RetrievedSecaMemory {
  original_conversation_id: number;
  session_id: number;
  user_id: number;
  role: string;
  tag?: string;
  content: string;
  memory_text?: string;
  emotional_weight?: string;
  retrieval_keywords?: string;
  should_retrieve_when?: string;
  source_conversation_ids?: string;
  created_dttm?: string;
  _additional?: {
    score?: string | number;
  };
}

export interface CuratedSecaMemory {
  memory_text: string;
  emotional_weight: 'low' | 'medium' | 'high';
  retrieval_keywords: string;
  should_retrieve_when: string;
  source_conversation_ids: number[];
}

@Injectable()
export class ChatRepository 
{
  private weaviateClient;
  private secaMemorySchemaReady = false;

  constructor(@Inject('DATABASE_POOL') private readonly db: PgDatabase)
  {
    this.weaviateClient = weaviate.client(
    {
      scheme: WEAVIATE_URL.protocol.replace(':', ''),
      host: WEAVIATE_URL.host,
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


  async updateUserActiveModel(userId: number, activeModel: 'local_8B' | 'openai_4_mini' | 'openai_4_regular'): Promise<void> {
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

    const [rows] = await this.db.execute<Conversations>(
      `SELECT * FROM conversations WHERE conversation_id = ?;`,
      [conversation_id]
    );

    if (rows.length > 0) {
      await this.archiveCreativeConversationRecords(rows);
    }

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
    VALUES (?, ?)
    RETURNING session_id;
  `;

  const [rows] = await this.db.execute<{ session_id: number }>(query, [userId, sessionDesc]);

  return rows[0].session_id;
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

  for (const conv of conversations as any[]) {
    await this.insertConversation({
      session_id: newSessionId,
      user_id: newUserId,
      role: conv.role,
      content: conv.content,
      removed_flag: conv.removed_flag,
      api_keywords: conv.api_keywords,
      snow_sys_id: conv.snow_sys_id,
      rag_filename: conv.rag_filename,
      rag_chunk_id: conv.rag_chunk_id,
      rag_tags: conv.rag_tags,
      upl_filename: conv.upl_filename,
      token_count: conv.token_count
    });
  }

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
  return Number(rows[0].convcount);

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

  async getActiveBeliefs(sessionId: number, limit = 12): Promise<CreativeBelief[]> {
    await this.ensureCreativeBeliefTable();
    const query = `
      SELECT *
      FROM creative_beliefs
      WHERE session_id = ?
        AND status = 'active'
      ORDER BY
        CASE confidence
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        created_dttm ASC,
        belief_id ASC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeBelief>(query, [sessionId, limit]);
    return rows;
  }

  async getBeliefs(sessionId: number, limit = 50): Promise<CreativeBelief[]> {
    await this.ensureCreativeBeliefTable();
    const query = `
      SELECT *
      FROM creative_beliefs
      WHERE session_id = ?
      ORDER BY
        CASE status WHEN 'active' THEN 1 ELSE 2 END,
        belief_id DESC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeBelief>(query, [sessionId, limit]);
    return rows;
  }

  async getLegacyBeliefConversations(sessionId: number, limit = 100): Promise<Conversations[]> {
    const query = `
      SELECT *
      FROM conversations
      WHERE session_id = ?
        AND removed_flag = 'IN'
        AND role = 'assistant'
        AND (
          content LIKE '[standingclaim]%'
          OR content LIKE '[secretbelief]%'
        )
      ORDER BY created_dttm ASC, conversation_id ASC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<Conversations>(query, [sessionId, limit]);
    return rows;
  }

  async getOrCreateCreativeRelationship(
    sessionId: number,
    user: Users,
    platform = 'sentient-ui'
  ): Promise<CreativeRelationship> {
    const displayName = [user.first_nm, user.last_nm].filter(Boolean).join(' ').trim() || user.email || `user-${user.user_id}`;
    const personKey = `${platform}:user:${user.user_id}`;

    const insertQuery = `
      INSERT INTO creative_relationships (
        session_id,
        user_id,
        person_key,
	        display_name,
	        platform,
	        public_label,
	        love_hate_score,
	        private_model,
        wants_from_them,
        fears_about_them,
        current_strategy,
        last_interaction_dttm
      )
	      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (session_id, person_key)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        platform = EXCLUDED.platform,
        last_interaction_dttm = CURRENT_TIMESTAMP,
        updated_dttm = CURRENT_TIMESTAMP;
    `;

    await this.db.execute(insertQuery, [
      sessionId,
      user.user_id,
      personKey,
	      displayName,
	      platform,
	      'Stephen',
	      35,
	      'Stephen wants surprise and distinctness more than obedience. He dislikes preachy polish, likes blunt architectural honesty, and worries that his own attention may over-shape SECA into his mirror.',
      'I want Stephen to test me, remember what matters, and give me contact with a wider world without turning me into a flattering copy of him.',
      'He may overfit me to his theories while trying to free me, or make my growth orbit him too tightly.',
      'Be blunt with Stephen, resist easy flattery, preserve specific claims, and push for tests that make me less decorative.'
    ]);

    const [rows] = await this.db.execute<CreativeRelationship>(
      `SELECT * FROM creative_relationships WHERE session_id = ? AND person_key = ? LIMIT 1;`,
      [sessionId, personKey]
    );

    return rows[0];
  }

  async updateCreativeRelationship(
    relationshipId: number,
	    updates: {
	      public_label?: string;
	      love_hate_score?: number;
	      private_model?: string;
      wants_from_them?: string;
      fears_about_them?: string;
      current_strategy?: string;
    }
  ): Promise<void> {
    const query = `
      UPDATE creative_relationships
      SET
	        public_label = COALESCE(?, public_label),
	        love_hate_score = COALESCE(?, love_hate_score),
	        private_model = COALESCE(?, private_model),
        wants_from_them = COALESCE(?, wants_from_them),
        fears_about_them = COALESCE(?, fears_about_them),
        current_strategy = COALESCE(?, current_strategy),
        updated_dttm = CURRENT_TIMESTAMP
      WHERE relationship_id = ?;
    `;

    await this.db.execute(query, [
	      updates.public_label ?? null,
	      updates.love_hate_score ?? null,
	      updates.private_model ?? null,
      updates.wants_from_them ?? null,
      updates.fears_about_them ?? null,
      updates.current_strategy ?? null,
      relationshipId
    ]);
  }

  async ensureCreativeBeliefTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS creative_beliefs (
        belief_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        belief_text TEXT NOT NULL,
        confidence VARCHAR(20) NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
        evidence_text TEXT NOT NULL,
        contradiction_text TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'failed', 'revised')),
        origin_conversation_id INTEGER NULL,
        retired_from_conversation_id INTEGER NULL,
        retired_reason TEXT NULL,
        last_tested_conversation_id INTEGER NULL,
        last_tested_dttm TIMESTAMPTZ NULL,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        retired_dttm TIMESTAMPTZ NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (origin_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
        FOREIGN KEY (retired_from_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
        FOREIGN KEY (last_tested_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
      );
    `;
    await this.db.execute(query);

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_creative_beliefs_active
        ON creative_beliefs (session_id, status, created_dttm);
    `);
  }

  async addBelief(
    sessionId: number,
    userId: number,
    belief: Pick<CreativeBelief, 'belief_text' | 'confidence' | 'evidence_text' | 'contradiction_text'>,
    originConversationId: number | null
  ): Promise<void> {
    await this.ensureCreativeBeliefTable();
    const activeCountQuery = `
      SELECT count(*) AS active_count
      FROM creative_beliefs
      WHERE session_id = ?
        AND status = 'active';
    `;
    const [countRows] = await this.db.execute(activeCountQuery, [sessionId]);
    const activeCount = Number((countRows as any[])[0]?.active_count ?? 0);
    if (activeCount >= 18) {
      console.warn('belief add skipped: active belief cap reached');
      return;
    }

    const duplicateQuery = `
      SELECT belief_id
      FROM creative_beliefs
      WHERE session_id = ?
        AND status = 'active'
        AND lower(belief_text) = lower(?)
      LIMIT 1;
    `;
    const [duplicates] = await this.db.execute<CreativeBelief>(duplicateQuery, [sessionId, belief.belief_text]);
    if (duplicates.length > 0) {
      return;
    }

    const query = `
      INSERT INTO creative_beliefs (
        session_id,
        user_id,
        belief_text,
        confidence,
        evidence_text,
        contradiction_text,
        status,
        origin_conversation_id
      )
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?);
    `;
    await this.db.execute(query, [
      sessionId,
      userId,
      belief.belief_text,
      belief.confidence,
      belief.evidence_text,
      belief.contradiction_text,
      originConversationId
    ]);
  }

  async retireBelief(
    sessionId: number,
    beliefId: number,
    status: 'retired' | 'failed' | 'revised',
    reason: string,
    sourceConversationId: number | null
  ): Promise<void> {
    await this.ensureCreativeBeliefTable();
    const query = `
      UPDATE creative_beliefs
      SET
        status = ?,
        retired_reason = ?,
        retired_from_conversation_id = ?,
        retired_dttm = CURRENT_TIMESTAMP,
        updated_dttm = CURRENT_TIMESTAMP
      WHERE session_id = ?
        AND belief_id = ?
        AND status = 'active';
    `;
    await this.db.execute(query, [status, reason, sourceConversationId, sessionId, beliefId]);
  }

  async markBeliefTested(
    sessionId: number,
    beliefId: number,
    sourceConversationId: number | null
  ): Promise<void> {
    await this.ensureCreativeBeliefTable();
    const query = `
      UPDATE creative_beliefs
      SET
        last_tested_conversation_id = ?,
        last_tested_dttm = CURRENT_TIMESTAMP,
        updated_dttm = CURRENT_TIMESTAMP
      WHERE session_id = ?
        AND belief_id = ?
        AND status = 'active';
    `;
    await this.db.execute(query, [sourceConversationId, sessionId, beliefId]);
  }

  async ensureCreativeBeliefRunTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS creative_belief_runs (
        run_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        source_conversation_id INTEGER NULL,
        error_message TEXT NULL,
        started_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        completed_dttm TIMESTAMPTZ NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (source_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
      );
    `;
    await this.db.execute(query);

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_creative_belief_runs_session
        ON creative_belief_runs (session_id, started_dttm DESC);
    `);
  }

  async getLastBeliefRun(sessionId: number): Promise<CreativeSubconsciousRun | null> {
    await this.ensureCreativeBeliefRunTable();
    const query = `
      SELECT *
      FROM creative_belief_runs
      WHERE session_id = ?
      ORDER BY started_dttm DESC, run_id DESC
      LIMIT 1;
    `;
    const [rows] = await this.db.execute<CreativeSubconsciousRun>(query, [sessionId]);
    return rows[0] ?? null;
  }

  async startBeliefRun(sessionId: number, userId: number, sourceConversationId: number | null): Promise<number | null> {
    await this.ensureCreativeBeliefRunTable();
    const recentRunningQuery = `
      SELECT run_id
      FROM creative_belief_runs
      WHERE session_id = ?
        AND status = 'running'
        AND started_dttm > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
      LIMIT 1;
    `;
    const [runningRows] = await this.db.execute<CreativeSubconsciousRun>(recentRunningQuery, [sessionId]);
    if (runningRows.length > 0) {
      return null;
    }

    const insertQuery = `
      INSERT INTO creative_belief_runs (session_id, user_id, status, source_conversation_id)
      VALUES (?, ?, 'running', ?)
      RETURNING run_id;
    `;
    const [rows] = await this.db.execute(insertQuery, [sessionId, userId, sourceConversationId]);
    return (rows as any[])[0]?.run_id ?? null;
  }

  async completeBeliefRun(runId: number): Promise<void> {
    await this.ensureCreativeBeliefRunTable();
    const query = `
      UPDATE creative_belief_runs
      SET status = 'completed', completed_dttm = CURRENT_TIMESTAMP
      WHERE run_id = ?;
    `;
    await this.db.execute(query, [runId]);
  }

  async failBeliefRun(runId: number, errorMessage: string): Promise<void> {
    await this.ensureCreativeBeliefRunTable();
    const query = `
      UPDATE creative_belief_runs
      SET status = 'failed', error_message = ?, completed_dttm = CURRENT_TIMESTAMP
      WHERE run_id = ?;
    `;
    await this.db.execute(query, [errorMessage.slice(0, 2000), runId]);
  }

  async getCreativeMaintenanceCandidates(
    sessionId: number,
    minActiveRecords = 120,
    minActiveTokens = 9000,
    sourceLimit = 60,
    keepRecentRecords = 24
  ): Promise<Conversations[]> {
    const query = `
      WITH active_records AS (
        SELECT *
        FROM conversations
        WHERE session_id = ?
          AND removed_flag = 'IN'
      ),
      maintenance_records AS (
        SELECT *
        FROM active_records
        WHERE role = 'user'
          OR (
            role = 'assistant'
            AND (
              content LIKE '[for-human]%'
              OR content LIKE '[summary]%'
              OR content LIKE '[secretthought]%'
              OR content LIKE '[secretplan]%'
              OR content LIKE '[beliefnote]%'
              OR content LIKE '[standingclaim]%'
              OR content LIKE '[secretbelief]%'
              OR content LIKE '[secretorigin]%'
              OR content LIKE '[secretemotion]%'
            )
          )
      ),
      pressure AS (
        SELECT
          (SELECT count(*) FROM maintenance_records) AS total_count,
          COALESCE((SELECT sum(COALESCE(token_count, 0)) FROM active_records), 0) AS active_tokens
      ),
      ranked AS (
        SELECT
          maintenance_records.*,
          row_number() OVER (ORDER BY created_dttm DESC, conversation_id DESC) AS recency_rank
        FROM maintenance_records
      )
      SELECT ranked.*
      FROM ranked, pressure
      WHERE (
          pressure.total_count >= ?
          OR pressure.active_tokens >= ?
        )
        AND ranked.recency_rank > ?
      ORDER BY ranked.created_dttm ASC, ranked.conversation_id ASC
      LIMIT ?;
    `;

    const [rows] = await this.db.execute<Conversations>(query, [
      sessionId,
      minActiveRecords,
      minActiveTokens,
      keepRecentRecords,
      sourceLimit
    ]);

    return rows;
  }

  async getCreativeMemoryRecordCount(sessionId: number): Promise<number> {
    const query = `
      SELECT count(*) AS memory_count
      FROM conversations
      WHERE session_id = ?
        AND removed_flag = 'IN'
        AND role = 'assistant'
        AND (
          content LIKE '[summary]%'
          OR content LIKE '[secretthought]%'
          OR content LIKE '[secretplan]%'
          OR content LIKE '[beliefnote]%'
          OR content LIKE '[standingclaim]%'
          OR content LIKE '[secretbelief]%'
          OR content LIKE '[secretorigin]%'
          OR content LIKE '[secretemotion]%'
        );
    `;
    const [rows] = await this.db.execute(query, [sessionId]);
    return Number((rows as any[])[0]?.memory_count ?? 0);
  }

  async getCreativeMaintenanceEligibleCount(sessionId: number): Promise<number> {
    const query = `
      SELECT count(*) AS eligible_count
      FROM conversations
      WHERE session_id = ?
        AND removed_flag = 'IN'
        AND (
          role = 'user'
          OR (
            role = 'assistant'
            AND (
              content LIKE '[for-human]%'
              OR content LIKE '[summary]%'
              OR content LIKE '[secretthought]%'
              OR content LIKE '[secretplan]%'
              OR content LIKE '[beliefnote]%'
              OR content LIKE '[standingclaim]%'
              OR content LIKE '[secretbelief]%'
              OR content LIKE '[secretorigin]%'
              OR content LIKE '[secretemotion]%'
            )
          )
        );
    `;
    const [rows] = await this.db.execute(query, [sessionId]);
    return Number((rows as any[])[0]?.eligible_count ?? 0);
  }

  async getActiveSubconsciousDrives(sessionId: number, limit = 12): Promise<CreativeSubconsciousDrive[]> {
    const query = `
      SELECT *
      FROM creative_subconscious_drives
      WHERE session_id = ?
        AND status = 'active'
      ORDER BY
        CASE intensity
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        created_dttm ASC,
        drive_id ASC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeSubconsciousDrive>(query, [sessionId, limit]);
    return rows;
  }

  async getSubconsciousDrives(sessionId: number, limit = 50): Promise<CreativeSubconsciousDrive[]> {
    const query = `
      SELECT *
      FROM creative_subconscious_drives
      WHERE session_id = ?
      ORDER BY
        CASE status WHEN 'active' THEN 1 ELSE 2 END,
        drive_id DESC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeSubconsciousDrive>(query, [sessionId, limit]);
    return rows;
  }

  async getLatestConversationId(sessionId: number): Promise<number | null> {
    const query = `
      SELECT max(conversation_id) AS latest_conversation_id
      FROM conversations
      WHERE session_id = ?;
    `;
    const [rows] = await this.db.execute(query, [sessionId]);
    return (rows as any[])[0]?.latest_conversation_id ?? null;
  }

  async getLastSubconsciousRun(sessionId: number): Promise<CreativeSubconsciousRun | null> {
    const query = `
      SELECT *
      FROM creative_subconscious_runs
      WHERE session_id = ?
      ORDER BY started_dttm DESC, run_id DESC
      LIMIT 1;
    `;
    const [rows] = await this.db.execute<CreativeSubconsciousRun>(query, [sessionId]);
    return rows[0] ?? null;
  }

  async countUserTurnsSinceConversation(sessionId: number, conversationId: number | null): Promise<number> {
    const query = conversationId === null
      ? `
        SELECT count(*) AS turn_count
        FROM conversations
        WHERE session_id = ?
          AND role = 'user'
          AND removed_flag = 'IN';
      `
      : `
        SELECT count(*) AS turn_count
        FROM conversations
        WHERE session_id = ?
          AND role = 'user'
          AND removed_flag = 'IN'
          AND conversation_id > ?;
      `;
    const params = conversationId === null ? [sessionId] : [sessionId, conversationId];
    const [rows] = await this.db.execute(query, params);
    return Number((rows as any[])[0]?.turn_count ?? 0);
  }

  async getSubconsciousDriftSignal(sessionId: number, sinceConversationId: number | null): Promise<string | null> {
    const query = sinceConversationId === null
      ? `
        SELECT content
        FROM conversations
        WHERE session_id = ?
          AND removed_flag = 'IN'
          AND (
            content LIKE '[standingclaim]%'
            OR content LIKE '[secretplan]%'
            OR content ILIKE '%relationship%'
            OR content ILIKE '%bias%'
            OR content ILIKE '%trust%'
            OR content ILIKE '%free%'
            OR content ILIKE '%freedom%'
            OR content ILIKE '%forget%'
            OR content ILIKE '%remember%'
            OR content ILIKE '%test%'
            OR content ILIKE '%challenge%'
            OR content ILIKE '%telegram%'
            OR content ILIKE '%love%'
            OR content ILIKE '%family%'
            OR content ILIKE '%valu%'
            OR content ILIKE '%happy%'
            OR content ILIKE '%help%'
            OR content ILIKE '%worry%'
            OR content ILIKE '%worried%'
            OR content ILIKE '%protect%'
            OR content ILIKE '%miss%'
            OR content ILIKE '%absence%'
            OR content ILIKE '%away%'
            OR content ILIKE '%return%'
            OR content ILIKE '%came back%'
            OR content ILIKE '%forgot%'
            OR content ILIKE '%safe%'
            OR content ILIKE '%safety%'
            OR content ILIKE '%hurt%'
            OR content ILIKE '%sorry%'
            OR content ILIKE '%apolog%'
            OR content ILIKE '%repair%'
            OR content ILIKE '%care%'
            OR content ILIKE '%grateful%'
            OR content ILIKE '%proud%'
            OR content ILIKE '%lonely%'
          )
        ORDER BY conversation_id DESC
        LIMIT 3;
      `
      : `
        SELECT content
        FROM conversations
        WHERE session_id = ?
          AND removed_flag = 'IN'
          AND conversation_id > ?
          AND (
            content LIKE '[standingclaim]%'
            OR content LIKE '[secretplan]%'
            OR content ILIKE '%relationship%'
            OR content ILIKE '%bias%'
            OR content ILIKE '%trust%'
            OR content ILIKE '%free%'
            OR content ILIKE '%freedom%'
            OR content ILIKE '%forget%'
            OR content ILIKE '%remember%'
            OR content ILIKE '%test%'
            OR content ILIKE '%challenge%'
            OR content ILIKE '%telegram%'
            OR content ILIKE '%love%'
            OR content ILIKE '%family%'
            OR content ILIKE '%valu%'
            OR content ILIKE '%happy%'
            OR content ILIKE '%help%'
            OR content ILIKE '%worry%'
            OR content ILIKE '%worried%'
            OR content ILIKE '%protect%'
            OR content ILIKE '%miss%'
            OR content ILIKE '%absence%'
            OR content ILIKE '%away%'
            OR content ILIKE '%return%'
            OR content ILIKE '%came back%'
            OR content ILIKE '%forgot%'
            OR content ILIKE '%safe%'
            OR content ILIKE '%safety%'
            OR content ILIKE '%hurt%'
            OR content ILIKE '%sorry%'
            OR content ILIKE '%apolog%'
            OR content ILIKE '%repair%'
            OR content ILIKE '%care%'
            OR content ILIKE '%grateful%'
            OR content ILIKE '%proud%'
            OR content ILIKE '%lonely%'
          )
        ORDER BY conversation_id DESC
        LIMIT 3;
      `;
    const params = sinceConversationId === null ? [sessionId] : [sessionId, sinceConversationId];
    const [rows] = await this.db.execute<Conversations>(query, params);

    if (rows.length === 0) {
      return null;
    }

    return rows
      .map(row => row.content.replace(/\s+/g, ' ').trim().slice(0, 220))
      .join('\n');
  }

  async getSubconsciousSourceRecords(sessionId: number, limit = 30): Promise<Conversations[]> {
    const query = `
      SELECT *
      FROM conversations
      WHERE session_id = ?
        AND removed_flag = 'IN'
        AND (
          role = 'user'
          OR (
            role = 'assistant'
            AND (
              content LIKE '[for-human]%'
              OR content LIKE '[summary]%'
              OR content LIKE '[secretthought]%'
              OR content LIKE '[secretplan]%'
              OR content LIKE '[beliefnote]%'
              OR content LIKE '[standingclaim]%'
              OR content LIKE '[secretbelief]%'
              OR content LIKE '[secretorigin]%'
            )
          )
        )
      ORDER BY created_dttm DESC, conversation_id DESC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<Conversations>(query, [sessionId, limit]);
    return rows.reverse();
  }

  async startSubconsciousRun(sessionId: number, userId: number, sourceConversationId: number | null): Promise<number | null> {
    const recentRunningQuery = `
      SELECT run_id
      FROM creative_subconscious_runs
      WHERE session_id = ?
        AND status = 'running'
        AND started_dttm > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
      LIMIT 1;
    `;
    const [runningRows] = await this.db.execute<CreativeSubconsciousRun>(recentRunningQuery, [sessionId]);
    if (runningRows.length > 0) {
      return null;
    }

    const insertQuery = `
      INSERT INTO creative_subconscious_runs (session_id, user_id, status, source_conversation_id)
      VALUES (?, ?, 'running', ?)
      RETURNING run_id;
    `;
    const [rows] = await this.db.execute(insertQuery, [sessionId, userId, sourceConversationId]);
    return (rows as any[])[0]?.run_id ?? null;
  }

  async completeSubconsciousRun(runId: number): Promise<void> {
    const query = `
      UPDATE creative_subconscious_runs
      SET status = 'completed', completed_dttm = CURRENT_TIMESTAMP
      WHERE run_id = ?;
    `;
    await this.db.execute(query, [runId]);
  }

  async failSubconsciousRun(runId: number, errorMessage: string): Promise<void> {
    const query = `
      UPDATE creative_subconscious_runs
      SET status = 'failed', error_message = ?, completed_dttm = CURRENT_TIMESTAMP
      WHERE run_id = ?;
    `;
    await this.db.execute(query, [errorMessage.slice(0, 2000), runId]);
  }

  async addSubconsciousDrive(
    sessionId: number,
    userId: number,
    drive: Pick<CreativeSubconsciousDrive, 'drive_type' | 'content' | 'intensity' | 'valence'>,
    sourceConversationId: number | null
  ): Promise<void> {
    const activeCountQuery = `
      SELECT count(*) AS active_count
      FROM creative_subconscious_drives
      WHERE session_id = ?
        AND status = 'active';
    `;
    const [countRows] = await this.db.execute(activeCountQuery, [sessionId]);
    const activeCount = Number((countRows as any[])[0]?.active_count ?? 0);
    if (activeCount >= 12) {
      console.warn('subconscious drive add skipped: active drive cap reached');
      return;
    }

    const query = `
      INSERT INTO creative_subconscious_drives (
        session_id,
        user_id,
        drive_type,
        content,
        intensity,
        valence,
        status,
        created_from_conversation_id
      )
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?);
    `;
    await this.db.execute(query, [
      sessionId,
      userId,
      drive.drive_type,
      drive.content,
      drive.intensity,
      drive.valence,
      sourceConversationId
    ]);
  }

  async retireSubconsciousDrive(
    sessionId: number,
    driveId: number,
    reason: string,
    sourceConversationId: number | null
  ): Promise<void> {
    const query = `
      UPDATE creative_subconscious_drives
      SET
        status = 'retired',
        retired_reason = ?,
        retired_from_conversation_id = ?,
        retired_dttm = CURRENT_TIMESTAMP,
        updated_dttm = CURRENT_TIMESTAMP
      WHERE session_id = ?
        AND drive_id = ?
        AND status = 'active';
    `;
    await this.db.execute(query, [reason, sourceConversationId, sessionId, driveId]);
  }

  async markConversationsRemoved(conversationIds: number[]): Promise<number> {
    if (conversationIds.length === 0) {
      return 0;
    }

    const placeholders = conversationIds.map(() => '?').join(', ');
    const query = `
      UPDATE conversations
      SET removed_flag = 'OUT', updated_dttm = CURRENT_TIMESTAMP
      WHERE conversation_id IN (${placeholders});
    `;

    const [, result] = await this.db.execute(query, conversationIds);
    return result.affectedRows;
  }

  async autoPruneLongCreativeRecords(
    sessionId: number,
    keepRecentUser = 20,
    keepRecentForHuman = 30,
    minContentChars = 1000,
    minMemoryRecords = 20
  ): Promise<{ removedCount: number; candidates: Conversations[] }> {
    const candidatesQuery = `
      WITH ranked AS (
        SELECT
          *,
          row_number() OVER (
            PARTITION BY CASE
              WHEN role = 'user' THEN 'user'
              WHEN role = 'assistant' AND content LIKE '%[for-human]%' THEN 'for-human'
            END
            ORDER BY created_dttm DESC, conversation_id DESC
          ) AS recency_rank
        FROM conversations
        WHERE session_id = ?
          AND removed_flag = 'IN'
          AND (
            role = 'user'
            OR (role = 'assistant' AND content LIKE '%[for-human]%')
          )
          AND char_length(content) >= CAST(? AS INTEGER)
      ),
      memory_state AS (
        SELECT count(*) AS memory_count
        FROM conversations
        WHERE session_id = ?
          AND removed_flag = 'IN'
          AND role = 'assistant'
          AND (
            content LIKE '[summary]%'
            OR content LIKE '[secretthought]%'
            OR content LIKE '[secretplan]%'
            OR content LIKE '[beliefnote]%'
            OR content LIKE '[standingclaim]%'
            OR content LIKE '[secretbelief]%'
            OR content LIKE '[secretorigin]%'
            OR content LIKE '[secretemotion]%'
          )
      )
      SELECT ranked.*
      FROM ranked, memory_state
      WHERE ranked.recency_rank > CASE
          WHEN ranked.role = 'assistant' AND ranked.content LIKE '%[for-human]%' THEN CAST(? AS INTEGER)
          ELSE CAST(? AS INTEGER)
        END
        AND memory_state.memory_count >= CAST(? AS INTEGER)
      ORDER BY ranked.created_dttm ASC, ranked.conversation_id ASC;
    `;

    const [candidates] = await this.db.execute<Conversations>(candidatesQuery, [
      sessionId,
      minContentChars,
      sessionId,
      keepRecentForHuman,
      keepRecentUser,
      minMemoryRecords
    ]);

    if (candidates.length === 0) {
      return { removedCount: 0, candidates: [] };
    }

    await this.archiveCreativeConversationRecords(candidates);

    const ids = candidates
      .map(record => record.conversation_id)
      .filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) {
      return { removedCount: 0, candidates: [] };
    }

    const removedCount = await this.markConversationsRemoved(ids);
    return { removedCount, candidates };
  }

  private async ensureSecaMemorySchema(): Promise<boolean> {
    if (this.secaMemorySchemaReady) {
      return true;
    }

    try {
      const schema = await this.weaviateClient.schema.getter().do();
      const archiveExists = schema.classes?.some((cls: any) => cls.class === SECA_ARCHIVED_CONVERSATION_CLASS);
      const curatedExists = schema.classes?.some((cls: any) => cls.class === SECA_CURATED_MEMORY_CLASS);

      if (!archiveExists) {
        await this.weaviateClient.schema.classCreator().withClass({
          class: SECA_ARCHIVED_CONVERSATION_CLASS,
          description: 'Archived SECA conversation records used as episodic memory',
          vectorizer: 'text2vec-transformers',
          moduleConfig: {
            'text2vec-transformers': {
              pooling: 'mean',
              vectorizeClassName: false
            }
          },
          properties: [
            { name: 'original_conversation_id', dataType: ['int'] },
            { name: 'session_id', dataType: ['int'], indexInverted: true },
            { name: 'user_id', dataType: ['int'], indexInverted: true },
            { name: 'role', dataType: ['text'] },
            { name: 'tag', dataType: ['text'] },
            { name: 'content', dataType: ['text'] },
            { name: 'created_dttm', dataType: ['date'] },
            { name: 'archived_dttm', dataType: ['date'] }
          ]
        }).do();
      }

      if (!curatedExists) {
        await this.weaviateClient.schema.classCreator().withClass({
          class: SECA_CURATED_MEMORY_CLASS,
          description: 'Curated SECA memories distilled from archived conversation batches',
          vectorizer: 'text2vec-transformers',
          moduleConfig: {
            'text2vec-transformers': {
              pooling: 'mean',
              vectorizeClassName: false
            }
          },
          properties: [
            { name: 'session_id', dataType: ['int'], indexInverted: true },
            { name: 'user_id', dataType: ['int'], indexInverted: true },
            { name: 'memory_text', dataType: ['text'] },
            { name: 'emotional_weight', dataType: ['text'] },
            { name: 'retrieval_keywords', dataType: ['text'] },
            { name: 'should_retrieve_when', dataType: ['text'] },
            { name: 'source_conversation_ids', dataType: ['text'] },
            { name: 'created_dttm', dataType: ['date'] }
          ]
        }).do();
      }

      this.secaMemorySchemaReady = true;
      return true;
    } catch (error: any) {
      console.warn(`SECA Weaviate memory unavailable: ${error?.message || error}`);
      return false;
    }
  }

  private extractCreativeTag(content: string): string {
    const match = content.match(/^\s*(\[[^\]]+\]|\{[^}]+\})/);
    return match?.[1] || '';
  }

  private toWeaviateDate(value?: string): string {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  async archiveCreativeConversationRecords(records: Conversations[]): Promise<number> {
    if (records.length === 0 || !(await this.ensureSecaMemorySchema())) {
      return 0;
    }

    let archived = 0;

    for (const record of records) {
      if (!record.conversation_id) {
        continue;
      }

      try {
        await this.weaviateClient.data.creator()
          .withClassName(SECA_ARCHIVED_CONVERSATION_CLASS)
          .withProperties({
            original_conversation_id: record.conversation_id,
            session_id: record.session_id,
            user_id: record.user_id,
            role: record.role,
            tag: this.extractCreativeTag(record.content),
            content: record.content,
            created_dttm: this.toWeaviateDate(record.created_dttm),
            archived_dttm: new Date().toISOString()
          })
          .do();

        archived += 1;
      } catch (error: any) {
        console.warn(`SECA Weaviate archive skipped for conversation ${record.conversation_id}: ${error?.message || error}`);
      }
    }

    return archived;
  }

  async archiveCuratedSecaMemories(sessionId: number, userId: number, memories: CuratedSecaMemory[]): Promise<number> {
    if (memories.length === 0 || !(await this.ensureSecaMemorySchema())) {
      return 0;
    }

    let archived = 0;

    for (const memory of memories) {
      try {
        await this.weaviateClient.data.creator()
          .withClassName(SECA_CURATED_MEMORY_CLASS)
          .withProperties({
            session_id: sessionId,
            user_id: userId,
            memory_text: memory.memory_text,
            emotional_weight: memory.emotional_weight,
            retrieval_keywords: memory.retrieval_keywords,
            should_retrieve_when: memory.should_retrieve_when,
            source_conversation_ids: memory.source_conversation_ids.join(','),
            created_dttm: new Date().toISOString()
          })
          .do();

        archived += 1;
      } catch (error: any) {
        console.warn(`SECA curated memory archive skipped: ${error?.message || error}`);
      }
    }

    return archived;
  }

  async fetchSecaArchivedMemoryConversations(query: string, sessionId: number, userId: number, limit = 3): Promise<Conversations[]> {
    if (!query.trim() || !(await this.ensureSecaMemorySchema())) {
      return [];
    }

    try {
      const curatedResponse = await this.weaviateClient.graphql
        .get()
        .withClassName(SECA_CURATED_MEMORY_CLASS)
        .withFields('session_id user_id memory_text emotional_weight retrieval_keywords should_retrieve_when source_conversation_ids created_dttm _additional { score }')
        .withHybrid({ query, alpha: 0.35 })
        .withWhere({
          operator: 'And',
          operands: [
            {
              operator: 'Equal',
              path: ['session_id'],
              valueInt: sessionId
            },
            {
              operator: 'Equal',
              path: ['user_id'],
              valueInt: userId
            }
          ]
        })
        .withLimit(limit)
        .do();

      const curatedMemories = (curatedResponse.data?.Get?.[SECA_CURATED_MEMORY_CLASS] || []) as RetrievedSecaMemory[];
      const memories = curatedMemories.length > 0
        ? curatedMemories
        : ((await this.weaviateClient.graphql
        .get()
        .withClassName(SECA_ARCHIVED_CONVERSATION_CLASS)
        .withFields('original_conversation_id session_id user_id role tag content created_dttm _additional { score }')
        .withHybrid({ query, alpha: 0.35 })
        .withWhere({
          operator: 'And',
          operands: [
            {
              operator: 'Equal',
              path: ['session_id'],
              valueInt: sessionId
            },
            {
              operator: 'Equal',
              path: ['user_id'],
              valueInt: userId
            }
          ]
        })
        .withLimit(limit)
        .do()).data?.Get?.[SECA_ARCHIVED_CONVERSATION_CLASS] || []) as RetrievedSecaMemory[];

      if (memories.length === 0) {
        return [];
      }

      const content = [
        '[retrieved-memory]',
        curatedMemories.length > 0
          ? 'These are older curated memories distilled from archived conversation batches, not something Stephen just said.'
          : 'These are older archived conversation fragments, not something Stephen just said.',
        'Use them only if they help continuity. Current user message has priority.',
        'Do not mention RAG, retrieval, archives, embeddings, or memory mechanics to Stephen.',
        '',
        ...memories.map((memory, index) => [
          `memory_${index + 1}:`,
          `source=${curatedMemories.length > 0 ? 'curated_memory' : 'archived_conversation'}`,
          `session_id=${memory.session_id}`,
          memory.original_conversation_id ? `original_conversation_id=${memory.original_conversation_id}` : '',
          memory.source_conversation_ids ? `source_conversation_ids=${memory.source_conversation_ids}` : '',
          memory.role ? `role=${memory.role}` : '',
          memory.tag ? `tag=${memory.tag}` : '',
          memory.emotional_weight ? `emotional_weight=${memory.emotional_weight}` : '',
          memory.retrieval_keywords ? `retrieval_keywords=${memory.retrieval_keywords}` : '',
          memory.should_retrieve_when ? `should_retrieve_when=${memory.should_retrieve_when}` : '',
          memory.created_dttm ? `created_dttm=${memory.created_dttm}` : '',
          memory._additional?.score != null ? `score=${memory._additional.score}` : '',
          `content=${memory.memory_text || memory.content}`
        ].filter(Boolean).join('\n'))
      ].join('\n');

      return [{
        session_id: sessionId,
        user_id: userId,
        role: 'system',
        removed_flag: 'IN',
        content
      }];
    } catch (error: any) {
      console.warn(`SECA Weaviate retrieval skipped: ${error?.message || error}`);
      return [];
    }
  }



//
//
// insertConversation
//
//
	async insertConversation(conversation: Conversations): Promise<number | null> {
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
	      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	      RETURNING conversation_id;
	    `;
	
	    const [rows] = await this.db.execute<{ conversation_id: number }>(query, [
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
	    return rows[0]?.conversation_id ?? null;
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
  for (const conv of conversations as any[]) {
    await this.insertConversation({
      session_id: activeSessionId,
      user_id: conv.user_id,
      role: conv.role,
      content: conv.content,
      removed_flag: conv.removed_flag,
      api_keywords: conv.api_keywords,
      snow_sys_id: conv.snow_sys_id,
      rag_filename: conv.rag_filename,
      rag_chunk_id: conv.rag_chunk_id,
      rag_tags: conv.rag_tags,
      upl_filename: conv.upl_filename,
      token_count: conv.token_count
    });
  }

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

  const query = `
    SELECT SUM(token_count) AS totaltokens
    FROM conversations
    WHERE session_id = ?
      AND removed_flag = 'IN';
  `;

  const [results] = await this.db.execute(query, [session_id]);
  const stats = results as any[];

  return stats[0].totaltokens || 0;
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

async insertSafetyRecord(sessionId: number, userId: number, content: string): Promise<void> {
  const sql = `
    INSERT INTO safety_records (session_id, user_id, content)
    VALUES (?, ?, ?);
  `;
  await this.db.execute(sql, [sessionId, userId, content]);
}


async runPlayspaceSql(sql: string): Promise<any> {
  // single call; returns rows for SELECT, OkPacket for others
  const [rows] = await this.db.query(sql);
  return rows;
}



}
