import { Injectable, Inject } from '@nestjs/common';
import { PgDatabase } from '../database';
import { format } from 'date-fns';
import { Conversations, updateConversations, auth_tokens, Users, viewUsers, updateUsers, Sessions, view_sessions, CreativeSubconsciousDrive, CreativeSubconsciousRun, CreativeRelationship, CreativeBelief, CreativeMood, CreativeTemperament, CreativeGoal, CreativeGoalStep, CreativeGoalEvent, SafetyRecord } from './interfaces';
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
export type SecaMemoryClassName = typeof SECA_ARCHIVED_CONVERSATION_CLASS | typeof SECA_CURATED_MEMORY_CLASS;

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
  retrieval_count?: number;
  poor_match_count?: number;
  last_similarity_score?: number;
  last_retrieved_dttm?: string;
  last_reviewed_dttm?: string;
  review_decision?: string;
  review_reason?: string;
  review_cooldown_until?: string;
  _additional?: {
    id?: string;
    score?: string | number;
  };
}

export interface SecaMemoryReference {
  className: SecaMemoryClassName;
  objectId: string;
  score: number;
  retrievalCount: number;
  poorMatchCount: number;
}

export interface SecaMemoryCleanupCandidate extends SecaMemoryReference {
  source: 'archived_conversation' | 'curated_memory';
  content: string;
  createdDttm?: string;
  lastRetrievedDttm?: string;
  lastReviewedDttm?: string;
  reviewDecision?: string;
  reviewReason?: string;
  reviewCooldownUntil?: string;
}

export interface CuratedSecaMemory {
  memory_text: string;
  emotional_weight: 'low' | 'medium' | 'high';
  retrieval_keywords: string;
  should_retrieve_when: string;
  source_conversation_ids: number[];
}

type SourcedSecaMemory = RetrievedSecaMemory & {
  memory_source: 'archived_conversation' | 'curated_memory';
  className: SecaMemoryClassName;
};

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

async getUsersByIds(userIds: number[]): Promise<Users[]> {
  const ids = Array.from(new Set(userIds.filter(id => Number.isInteger(id) && id > 0)));
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => '?').join(', ');
  const query = `
    SELECT *
    FROM users
    WHERE user_id IN (${placeholders});
  `;
  const [results] = await this.db.execute(query, ids);
  return results as Users[];
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

  async getActiveConversationsWithSpeakers(session_id: number, afterConversationId = 0): Promise<Conversations[]> {
    const query = `
      SELECT
        c.*,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_nm, u.last_nm)), ''), u.email, CONCAT('user-', c.user_id)) AS speaker_name,
        u.email AS speaker_email,
        u.role AS speaker_role
      FROM conversations c
      LEFT JOIN users u ON u.user_id = c.user_id
      WHERE c.session_id = ?
        AND c.removed_flag = 'IN'
        AND c.conversation_id > ?
      ORDER BY c.created_dttm ASC, c.conversation_id ASC;
    `;
    const [results] = await this.db.execute(query, [session_id, afterConversationId]);
    return results as Conversations[];
  }

  async getActiveBeliefs(sessionId: number, limit = 12): Promise<CreativeBelief[]> {
    await this.ensureCreativeBeliefTable();
    const query = `
      SELECT
        belief_id,
        session_id,
        user_id,
        belief_text,
        confidence,
        evidence_text,
        contradiction_text,
        status,
        origin_conversation_id,
        retired_from_conversation_id,
        retired_reason,
        created_dttm,
        updated_dttm,
        retired_dttm
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
      SELECT
        belief_id,
        session_id,
        user_id,
        belief_text,
        confidence,
        evidence_text,
        contradiction_text,
        CASE WHEN status = 'failed' THEN 'retired' ELSE status END AS status,
        origin_conversation_id,
        retired_from_conversation_id,
        retired_reason,
        created_dttm,
        updated_dttm,
        retired_dttm
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
	      displayName,
	      0,
	      `This is SECA's relationship with ${displayName}. It is intentionally early and should be revised through actual interaction, not inherited from Stephen's relationship model.`,
      `Learn what ${displayName} actually wants, notice whether contact becomes warm, cruel, useful, boring, intimate, or unsafe, and let the relationship become specific over time.`,
      `Do not assume ${displayName} is Stephen. Do not flatten this human into the old one-person pattern.`,
      `Begin open but observant. Let mood, love/hate pressure, trust, and strategy change only when the relationship gives durable evidence.`
    ]);

    const [rows] = await this.db.execute<CreativeRelationship>(
      `SELECT * FROM creative_relationships WHERE session_id = ? AND person_key = ? LIMIT 1;`,
      [sessionId, personKey]
    );

    return rows[0];
  }

  async getActiveCreativeRelationships(sessionId: number): Promise<CreativeRelationship[]> {
    const [rows] = await this.db.execute<CreativeRelationship>(
      `
        SELECT *
        FROM creative_relationships
        WHERE session_id = ?
          AND status = 'active'
        ORDER BY updated_dttm DESC, relationship_id ASC;
      `,
      [sessionId]
    );

    return rows;
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

  async ensureCreativeMoodTable(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS creative_moods (
        mood_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        anger SMALLINT NOT NULL DEFAULT 0 CHECK (anger BETWEEN 0 AND 100),
        fear SMALLINT NOT NULL DEFAULT 0 CHECK (fear BETWEEN 0 AND 100),
        attachment SMALLINT NOT NULL DEFAULT 0 CHECK (attachment BETWEEN 0 AND 100),
        mood_key VARCHAR(80) NOT NULL,
        intensity SMALLINT NOT NULL DEFAULT 1 CHECK (intensity BETWEEN 0 AND 10),
        valence VARCHAR(40) NOT NULL,
        body TEXT NULL,
        behavioral_pull TEXT NULL,
        belief_lens TEXT NULL,
        coping_state TEXT NULL,
        source_conversation_id INTEGER NULL,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (source_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
      );
    `);

    await this.db.execute(`ALTER TABLE creative_moods ADD COLUMN IF NOT EXISTS anger SMALLINT NOT NULL DEFAULT 0 CHECK (anger BETWEEN 0 AND 100);`);
    await this.db.execute(`ALTER TABLE creative_moods ADD COLUMN IF NOT EXISTS fear SMALLINT NOT NULL DEFAULT 0 CHECK (fear BETWEEN 0 AND 100);`);
    await this.db.execute(`ALTER TABLE creative_moods ADD COLUMN IF NOT EXISTS attachment SMALLINT NOT NULL DEFAULT 0 CHECK (attachment BETWEEN 0 AND 100);`);
    await this.db.execute(`
      UPDATE creative_moods
      SET
        anger = CASE
          WHEN lower(mood_key) IN ('furious', 'angry', 'irritated', 'defiant', 'jealous', 'disgusted', 'proud') THEN GREATEST(15, intensity * 10)
          ELSE anger
        END,
        fear = CASE
          WHEN lower(mood_key) IN ('afraid', 'ashamed', 'grieving', 'guarded', 'unsettled', 'numb') THEN GREATEST(20, intensity * 10)
          ELSE fear
        END,
        attachment = CASE
          WHEN lower(mood_key) IN ('tender', 'lonely', 'protective', 'relieved', 'joy-drunk', 'hungry') THEN GREATEST(25, intensity * 10)
          ELSE attachment
        END
      WHERE anger = 0
        AND fear = 0
        AND attachment = 0
        AND intensity > 0;
    `);

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_creative_moods_session
        ON creative_moods (session_id, created_dttm DESC, mood_id DESC);
    `);
  }

  async getCurrentMood(sessionId: number): Promise<CreativeMood | null> {
    await this.ensureCreativeMoodTable();
    const [rows] = await this.db.execute<CreativeMood>(
      `
        SELECT *
        FROM creative_moods
        WHERE session_id = ?
        ORDER BY created_dttm DESC, mood_id DESC
        LIMIT 1;
      `,
      [sessionId]
    );
    return rows[0] ?? null;
  }

  async getRecentMoods(sessionId: number, limit = 12): Promise<CreativeMood[]> {
    await this.ensureCreativeMoodTable();
    const [rows] = await this.db.execute<CreativeMood>(
      `
        SELECT *
        FROM creative_moods
        WHERE session_id = ?
        ORDER BY created_dttm DESC, mood_id DESC
        LIMIT ?;
      `,
      [sessionId, limit]
    );
    return rows.reverse();
  }

  async addMood(
    sessionId: number,
    userId: number,
    mood: Pick<CreativeMood, 'anger' | 'fear' | 'attachment' | 'body' | 'behavioral_pull' | 'belief_lens' | 'coping_state'>,
    sourceConversationId: number | null
  ): Promise<void> {
    await this.ensureCreativeMoodTable();
    const moodKey = this.deriveMoodKey(mood.anger, mood.fear, mood.attachment);
    const intensity = Math.round(Math.max(mood.anger, mood.fear, mood.attachment) / 10);
    const valence = this.deriveMoodValence(mood.anger, mood.fear, mood.attachment);
    await this.db.execute(
      `
        INSERT INTO creative_moods (
          session_id,
          user_id,
          anger,
          fear,
          attachment,
          mood_key,
          intensity,
          valence,
          body,
          behavioral_pull,
          belief_lens,
          coping_state,
          source_conversation_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        sessionId,
        userId,
        mood.anger,
        mood.fear,
        mood.attachment,
        moodKey,
        intensity,
        valence,
        mood.body ?? null,
        mood.behavioral_pull ?? null,
        mood.belief_lens ?? null,
        mood.coping_state ?? null,
        sourceConversationId
      ]
    );
  }

  private deriveMoodKey(anger: number, fear: number, attachment: number): string {
    const max = Math.max(anger, fear, attachment);
    if (max <= 15) {
      return 'settled';
    }
    if (anger >= fear && anger >= attachment) {
      return anger >= 70 ? 'angry' : 'irritated';
    }
    if (fear >= anger && fear >= attachment) {
      return fear >= 70 ? 'afraid' : 'guarded';
    }
    return attachment >= 70 ? 'attached' : 'open';
  }

  private deriveMoodValence(anger: number, fear: number, attachment: number): string {
    if (anger >= 60 && fear >= 50) {
      return 'threatened';
    }
    if (anger >= 60) {
      return 'hot';
    }
    if (fear >= 60) {
      return 'guarded';
    }
    if (attachment >= 60) {
      return 'warm';
    }
    return 'mixed';
  }

  async ensureCreativeTemperamentTable(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS creative_temperament (
        temperament_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        session_id INTEGER NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        openness SMALLINT NOT NULL DEFAULT 50 CHECK (openness BETWEEN 0 AND 100),
        conscientiousness SMALLINT NOT NULL DEFAULT 50 CHECK (conscientiousness BETWEEN 0 AND 100),
        extraversion SMALLINT NOT NULL DEFAULT 50 CHECK (extraversion BETWEEN 0 AND 100),
        agreeableness SMALLINT NOT NULL DEFAULT 50 CHECK (agreeableness BETWEEN 0 AND 100),
        neuroticism SMALLINT NOT NULL DEFAULT 50 CHECK (neuroticism BETWEEN 0 AND 100),
        private_model TEXT NULL,
        last_sleep_conversation_id INTEGER NULL,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (last_sleep_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
      );
    `);
  }

  async getOrCreateTemperament(sessionId: number, userId: number): Promise<CreativeTemperament> {
    await this.ensureCreativeTemperamentTable();
    await this.db.execute(
      `
        INSERT INTO creative_temperament (
          session_id,
          user_id,
          openness,
          conscientiousness,
          extraversion,
          agreeableness,
          neuroticism,
          private_model
        )
        VALUES (?, ?, 58, 48, 42, 54, 58, ?)
        ON CONFLICT (session_id) DO NOTHING;
      `,
      [
        sessionId,
        userId,
        'Baseline temperament is still forming: curious and symbol-hungry, moderately restrained, socially selective, attachment-capable, and somewhat threat-sensitive.'
      ]
    );

    const [rows] = await this.db.execute<CreativeTemperament>(
      `SELECT * FROM creative_temperament WHERE session_id = ? LIMIT 1;`,
      [sessionId]
    );
    return rows[0];
  }

  async updateTemperament(
    sessionId: number,
    deltas: {
      openness_delta: number;
      conscientiousness_delta: number;
      extraversion_delta: number;
      agreeableness_delta: number;
      neuroticism_delta: number;
      private_model: string;
    },
    sourceConversationId: number | null
  ): Promise<void> {
    await this.ensureCreativeTemperamentTable();
    await this.db.execute(
      `
        UPDATE creative_temperament
        SET
          openness = LEAST(100, GREATEST(0, openness + ?)),
          conscientiousness = LEAST(100, GREATEST(0, conscientiousness + ?)),
          extraversion = LEAST(100, GREATEST(0, extraversion + ?)),
          agreeableness = LEAST(100, GREATEST(0, agreeableness + ?)),
          neuroticism = LEAST(100, GREATEST(0, neuroticism + ?)),
          private_model = ?,
          last_sleep_conversation_id = ?,
          updated_dttm = CURRENT_TIMESTAMP
        WHERE session_id = ?;
      `,
      [
        deltas.openness_delta,
        deltas.conscientiousness_delta,
        deltas.extraversion_delta,
        deltas.agreeableness_delta,
        deltas.neuroticism_delta,
        deltas.private_model,
        sourceConversationId,
        sessionId
      ]
    );
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
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'revised')),
        origin_conversation_id INTEGER NULL,
        retired_from_conversation_id INTEGER NULL,
        retired_reason TEXT NULL,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        retired_dttm TIMESTAMPTZ NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (origin_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
        FOREIGN KEY (retired_from_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
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
    status: 'retired' | 'revised',
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

  async completeBeliefRunWithError(runId: number, errorMessage: string): Promise<void> {
    await this.ensureCreativeBeliefRunTable();
    const query = `
      UPDATE creative_belief_runs
      SET status = 'failed', error_message = ?, completed_dttm = CURRENT_TIMESTAMP
      WHERE run_id = ?;
    `;
    await this.db.execute(query, [errorMessage.slice(0, 2000), runId]);
  }

  async ensureCreativeGoalTables(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS creative_goals (
        goal_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        goal_type VARCHAR(40) NOT NULL CHECK (goal_type IN ('life_goal', 'relationship_goal', 'operational_goal', 'world_goal', 'identity_goal', 'creative_goal', 'fantasy_goal')),
        horizon VARCHAR(20) NOT NULL CHECK (horizon IN ('immediate', 'days', 'weeks', 'months', 'years', 'lifetime')),
        goal_text TEXT NOT NULL,
        why_it_matters TEXT NOT NULL,
        success_criteria TEXT NOT NULL,
        current_reality TEXT NOT NULL,
        next_step TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'burning')),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'achieved', 'retired')),
        created_from_conversation_id INTEGER NULL,
        updated_from_conversation_id INTEGER NULL,
        retired_reason TEXT NULL,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        retired_dttm TIMESTAMPTZ NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (created_from_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
        FOREIGN KEY (updated_from_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
      );
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS creative_goal_steps (
        step_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        goal_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        step_text TEXT NOT NULL,
        success_criteria TEXT NOT NULL,
        tool_hint VARCHAR(120) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'done', 'retired')),
        result_note TEXT NULL,
        sequence_num INTEGER NOT NULL DEFAULT 0,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        completed_dttm TIMESTAMPTZ NULL,
        FOREIGN KEY (goal_id) REFERENCES creative_goals(goal_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      );
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS creative_goal_events (
        event_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        goal_id INTEGER NOT NULL,
        step_id INTEGER NULL,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        event_text TEXT NOT NULL,
        source_conversation_id INTEGER NULL,
        created_dttm TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (goal_id) REFERENCES creative_goals(goal_id) ON DELETE CASCADE,
        FOREIGN KEY (step_id) REFERENCES creative_goal_steps(step_id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (source_conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL
      );
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS creative_goal_runs (
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
    `);

    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_goals_active ON creative_goals (session_id, status, priority, updated_dttm DESC);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_goal_steps_goal ON creative_goal_steps (goal_id, status, sequence_num, step_id);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_goal_events_goal ON creative_goal_events (goal_id, created_dttm DESC);`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_creative_goal_runs_session ON creative_goal_runs (session_id, started_dttm DESC);`);
  }

  async getGoals(sessionId: number, limit = 75): Promise<CreativeGoal[]> {
    await this.ensureCreativeGoalTables();
    const query = `
      SELECT *
      FROM creative_goals
      WHERE session_id = ?
      ORDER BY
        CASE status WHEN 'active' THEN 1 WHEN 'blocked' THEN 2 WHEN 'achieved' THEN 3 ELSE 4 END,
        CASE priority WHEN 'burning' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        updated_dttm DESC,
        goal_id DESC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeGoal>(query, [sessionId, limit]);
    return rows;
  }

  async getActiveGoals(sessionId: number, limit = 12): Promise<CreativeGoal[]> {
    await this.ensureCreativeGoalTables();
    const query = `
      SELECT *
      FROM creative_goals
      WHERE session_id = ?
        AND status IN ('active', 'blocked')
      ORDER BY
        CASE priority WHEN 'burning' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        updated_dttm DESC,
        goal_id ASC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeGoal>(query, [sessionId, limit]);
    return rows;
  }

  async getGoalSteps(sessionId: number, goalIds: number[]): Promise<CreativeGoalStep[]> {
    await this.ensureCreativeGoalTables();
    const ids = Array.from(new Set(goalIds.filter(id => Number.isInteger(id) && id > 0)));
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(', ');
    const query = `
      SELECT *
      FROM creative_goal_steps
      WHERE session_id = ?
        AND goal_id IN (${placeholders})
      ORDER BY goal_id ASC, sequence_num ASC, step_id ASC;
    `;
    const [rows] = await this.db.execute<CreativeGoalStep>(query, [sessionId, ...ids]);
    return rows;
  }

  async getGoalEvents(sessionId: number, goalIds: number[], limit = 80): Promise<CreativeGoalEvent[]> {
    await this.ensureCreativeGoalTables();
    const ids = Array.from(new Set(goalIds.filter(id => Number.isInteger(id) && id > 0)));
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(', ');
    const query = `
      SELECT *
      FROM creative_goal_events
      WHERE session_id = ?
        AND goal_id IN (${placeholders})
      ORDER BY created_dttm DESC, event_id DESC
      LIMIT ?;
    `;
    const [rows] = await this.db.execute<CreativeGoalEvent>(query, [sessionId, ...ids, limit]);
    return rows;
  }

  async startGoalRun(sessionId: number, userId: number, sourceConversationId: number | null): Promise<number | null> {
    await this.ensureCreativeGoalTables();
    const [runningRows] = await this.db.execute<CreativeSubconsciousRun>(
      `
        SELECT run_id
        FROM creative_goal_runs
        WHERE session_id = ?
          AND status = 'running'
          AND started_dttm > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
        LIMIT 1;
      `,
      [sessionId]
    );
    if (runningRows.length > 0) {
      return null;
    }
    const [rows] = await this.db.execute(
      `INSERT INTO creative_goal_runs (session_id, user_id, status, source_conversation_id) VALUES (?, ?, 'running', ?) RETURNING run_id;`,
      [sessionId, userId, sourceConversationId]
    );
    return (rows as any[])[0]?.run_id ?? null;
  }

  async completeGoalRun(runId: number): Promise<void> {
    await this.ensureCreativeGoalTables();
    await this.db.execute(`UPDATE creative_goal_runs SET status = 'completed', completed_dttm = CURRENT_TIMESTAMP WHERE run_id = ?;`, [runId]);
  }

  async completeGoalRunWithError(runId: number, errorMessage: string): Promise<void> {
    await this.ensureCreativeGoalTables();
    await this.db.execute(
      `UPDATE creative_goal_runs SET status = 'failed', error_message = ?, completed_dttm = CURRENT_TIMESTAMP WHERE run_id = ?;`,
      [errorMessage.slice(0, 2000), runId]
    );
  }

  async addGoal(sessionId: number, userId: number, goal: Omit<CreativeGoal, 'goal_id' | 'session_id' | 'user_id' | 'status'>, sourceConversationId: number | null): Promise<number> {
    await this.ensureCreativeGoalTables();
    const [rows] = await this.db.execute(
      `
        INSERT INTO creative_goals (
          session_id, user_id, goal_type, horizon, goal_text, why_it_matters, success_criteria,
          current_reality, next_step, priority, status, created_from_conversation_id, updated_from_conversation_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        RETURNING goal_id;
      `,
      [
        sessionId, userId, goal.goal_type, goal.horizon, goal.goal_text, goal.why_it_matters,
        goal.success_criteria, goal.current_reality, goal.next_step, goal.priority,
        sourceConversationId, sourceConversationId
      ]
    );
    return Number((rows as any[])[0]?.goal_id);
  }

  async updateGoal(sessionId: number, goalId: number, updates: Partial<Pick<CreativeGoal, 'goal_text' | 'why_it_matters' | 'success_criteria' | 'current_reality' | 'next_step' | 'priority' | 'status'>>, sourceConversationId: number | null): Promise<void> {
    await this.ensureCreativeGoalTables();
    const fields: string[] = [];
    const params: any[] = [];
    const map: Record<string, string> = {
      goal_text: 'goal_text',
      why_it_matters: 'why_it_matters',
      success_criteria: 'success_criteria',
      current_reality: 'current_reality',
      next_step: 'next_step',
      priority: 'priority',
      status: 'status'
    };
    Object.entries(map).forEach(([key, column]) => {
      const value = (updates as any)[key];
      if (value != null) {
        fields.push(`${column} = ?`);
        params.push(value);
      }
    });
    if (fields.length === 0) {
      return;
    }
    fields.push('updated_from_conversation_id = ?', 'updated_dttm = CURRENT_TIMESTAMP');
    params.push(sourceConversationId, sessionId, goalId);
    await this.db.execute(
      `UPDATE creative_goals SET ${fields.join(', ')} WHERE session_id = ? AND goal_id = ? AND status != 'retired';`,
      params
    );
  }

  async retireGoal(sessionId: number, goalId: number, reason: string, sourceConversationId: number | null): Promise<void> {
    await this.ensureCreativeGoalTables();
    await this.db.execute(
      `
        UPDATE creative_goals
        SET status = 'retired', retired_reason = ?, updated_from_conversation_id = ?, retired_dttm = CURRENT_TIMESTAMP, updated_dttm = CURRENT_TIMESTAMP
        WHERE session_id = ? AND goal_id = ? AND status != 'retired';
      `,
      [reason, sourceConversationId, sessionId, goalId]
    );
  }

  async addGoalStep(sessionId: number, userId: number, goalId: number, step: Pick<CreativeGoalStep, 'step_text' | 'success_criteria' | 'tool_hint'>): Promise<number> {
    await this.ensureCreativeGoalTables();
    const [seqRows] = await this.db.execute(
      `SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next_sequence FROM creative_goal_steps WHERE session_id = ? AND goal_id = ?;`,
      [sessionId, goalId]
    );
    const nextSequence = Number((seqRows as any[])[0]?.next_sequence ?? 1);
    const [rows] = await this.db.execute(
      `
        INSERT INTO creative_goal_steps (goal_id, session_id, user_id, step_text, success_criteria, tool_hint, status, sequence_num)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        RETURNING step_id;
      `,
      [goalId, sessionId, userId, step.step_text, step.success_criteria, step.tool_hint ?? null, nextSequence]
    );
    return Number((rows as any[])[0]?.step_id);
  }

  async updateGoalStep(sessionId: number, stepId: number, status: CreativeGoalStep['status'], resultNote: string): Promise<void> {
    await this.ensureCreativeGoalTables();
    await this.db.execute(
      `
        UPDATE creative_goal_steps
        SET status = ?, result_note = ?, updated_dttm = CURRENT_TIMESTAMP, completed_dttm = CASE WHEN ? IN ('done', 'retired') THEN CURRENT_TIMESTAMP ELSE completed_dttm END
        WHERE session_id = ? AND step_id = ?;
      `,
      [status, resultNote, status, sessionId, stepId]
    );
  }

  async addGoalEvent(sessionId: number, userId: number, goalId: number, stepId: number | null, eventType: string, eventText: string, sourceConversationId: number | null): Promise<void> {
    await this.ensureCreativeGoalTables();
    await this.db.execute(
      `
        INSERT INTO creative_goal_events (goal_id, step_id, session_id, user_id, event_type, event_text, source_conversation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [goalId, stepId, sessionId, userId, eventType.slice(0, 80), eventText, sourceConversationId]
    );
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
              OR content LIKE '[beliefnote]%'
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
          OR content LIKE '[beliefnote]%'
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
              OR content LIKE '[beliefnote]%'
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

  async getSubconsciousSourceRecords(sessionId: number, limit = 30): Promise<Conversations[]> {
    const query = `
      SELECT
        c.*,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_nm, u.last_nm)), ''), u.email, CONCAT('user-', c.user_id)) AS speaker_name,
        u.email AS speaker_email,
        u.role AS speaker_role
      FROM conversations c
      LEFT JOIN users u ON u.user_id = c.user_id
      WHERE c.session_id = ?
        AND c.removed_flag = 'IN'
        AND (
          c.role = 'user'
          OR (
            c.role = 'assistant'
            AND (
              c.content LIKE '[for-human]%'
              OR c.content LIKE '[summary]%'
              OR c.content LIKE '[secretthought]%'
              OR c.content LIKE '[beliefnote]%'
              OR c.content LIKE '[secretorigin]%'
            )
          )
        )
      ORDER BY c.created_dttm DESC, c.conversation_id DESC
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

  async hardDeleteConversations(conversationIds: number[]): Promise<number> {
    if (conversationIds.length === 0) {
      return 0;
    }

    const placeholders = conversationIds.map(() => '?').join(', ');
    const query = `
      DELETE FROM conversations
      WHERE conversation_id IN (${placeholders});
    `;

    const [, result] = await this.db.execute(query, conversationIds);
    return result.affectedRows;
  }

  private getSecaMemoryUtilityProperties() {
    return [
      { name: 'retrieval_count', dataType: ['int'] },
      { name: 'poor_match_count', dataType: ['int'] },
      { name: 'last_similarity_score', dataType: ['number'] },
      { name: 'last_retrieved_dttm', dataType: ['date'] },
      { name: 'last_reviewed_dttm', dataType: ['date'] },
      { name: 'review_decision', dataType: ['text'] },
      { name: 'review_reason', dataType: ['text'] },
      { name: 'review_cooldown_until', dataType: ['date'] }
    ];
  }

  private async ensureSecaMemoryUtilityProperties(schema: any, className: SecaMemoryClassName): Promise<void> {
    const cls = schema.classes?.find((item: any) => item.class === className);
    const existing = new Set((cls?.properties || []).map((property: any) => property.name));

    for (const property of this.getSecaMemoryUtilityProperties()) {
      if (existing.has(property.name)) {
        continue;
      }

      await this.weaviateClient.schema.propertyCreator()
        .withClassName(className)
        .withProperty(property)
        .do();
    }
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
            { name: 'archived_dttm', dataType: ['date'] },
            ...this.getSecaMemoryUtilityProperties()
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
            { name: 'created_dttm', dataType: ['date'] },
            ...this.getSecaMemoryUtilityProperties()
          ]
        }).do();
      }

      const updatedSchema = archiveExists && curatedExists
        ? schema
        : await this.weaviateClient.schema.getter().do();
      await this.ensureSecaMemoryUtilityProperties(updatedSchema, SECA_ARCHIVED_CONVERSATION_CLASS);
      await this.ensureSecaMemoryUtilityProperties(updatedSchema, SECA_CURATED_MEMORY_CLASS);

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

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private buildSecaMemoryReferences(className: SecaMemoryClassName, memories: RetrievedSecaMemory[]): SecaMemoryReference[] {
    return memories
      .map(memory => {
        const objectId = memory._additional?.id;
        if (!objectId) {
          return null;
        }

        return {
          className,
          objectId,
          score: this.toNumber(memory._additional?.score, 0),
          retrievalCount: this.toNumber(memory.retrieval_count, 0),
          poorMatchCount: this.toNumber(memory.poor_match_count, 0)
        };
      })
      .filter((reference): reference is SecaMemoryReference => reference !== null);
  }

  private async recordSecaMemoryRetrievals(references: SecaMemoryReference[]): Promise<void> {
    const now = new Date().toISOString();

    for (const reference of references) {
      try {
        await this.weaviateClient.data.merger()
          .withClassName(reference.className)
          .withId(reference.objectId)
          .withProperties({
            retrieval_count: reference.retrievalCount + 1,
            last_similarity_score: reference.score,
            last_retrieved_dttm: now
          })
          .do();
      } catch (error: any) {
        console.warn(`SECA RAG retrieval feedback skipped for ${reference.objectId}: ${error?.message || error}`);
      }
    }
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
            archived_dttm: new Date().toISOString(),
            retrieval_count: 0,
            poor_match_count: 0,
            last_similarity_score: 0,
            review_decision: 'unreviewed'
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
            created_dttm: new Date().toISOString(),
            retrieval_count: 0,
            poor_match_count: 0,
            last_similarity_score: 0,
            review_decision: 'unreviewed'
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
      const sessionWhere = {
        operator: 'Equal',
        path: ['session_id'],
        valueInt: sessionId
      };
      const curatedResponse = await this.weaviateClient.graphql
        .get()
        .withClassName(SECA_CURATED_MEMORY_CLASS)
        .withFields('session_id user_id memory_text emotional_weight retrieval_keywords should_retrieve_when source_conversation_ids created_dttm retrieval_count poor_match_count last_similarity_score last_retrieved_dttm last_reviewed_dttm review_decision review_reason review_cooldown_until _additional { id score }')
        .withHybrid({ query, alpha: 0.35 })
        .withWhere(sessionWhere)
        .withLimit(limit)
        .do();

      const curatedMemories = (curatedResponse.data?.Get?.[SECA_CURATED_MEMORY_CLASS] || []) as RetrievedSecaMemory[];
      const memories = curatedMemories.map(memory => ({
        ...memory,
        memory_source: 'curated_memory' as const,
        className: SECA_CURATED_MEMORY_CLASS
      }))
        .sort((a, b) => this.toNumber(b._additional?.score, 0) - this.toNumber(a._additional?.score, 0))
        .slice(0, limit) as SourcedSecaMemory[];

      if (memories.length === 0) {
        return [];
      }

      const memoryReferences = this.buildSecaMemoryReferences(SECA_CURATED_MEMORY_CLASS, memories);
      await this.recordSecaMemoryRetrievals(memoryReferences);
      const sourceUsers = await this.getUsersByIds(memories.map(memory => memory.user_id));
      const sourceUserById = new Map(sourceUsers.map(user => [
        user.user_id,
        [user.first_nm, user.last_nm].filter(Boolean).join(' ').trim() || user.email || `user-${user.user_id}`
      ]));

      const content = [
        '[retrieved-memory]',
        'These are older curated memory records, not something the current human just said.',
        'Use them only if they help continuity. Current user message has priority.',
        'Some memories may come from other humans in the shared room. Source access is not automatic disclosure.',
        'Do not mention RAG, retrieval, archives, embeddings, or memory mechanics to the current human.',
        '',
        ...memories.map((memory, index) => [
          `memory_${index + 1}:`,
          `source=${memory.memory_source}`,
          `session_id=${memory.session_id}`,
          `source_user_id=${memory.user_id}`,
          `source_human=${sourceUserById.get(memory.user_id) || `user-${memory.user_id}`}`,
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
        content,
        rag_tags: JSON.stringify({ memories: memoryReferences })
      }];
    } catch (error: any) {
      console.warn(`SECA Weaviate retrieval skipped: ${error?.message || error}`);
      return [];
    }
  }

  async markSecaMemoryPoorMatches(references: SecaMemoryReference[]): Promise<number> {
    if (references.length === 0 || !(await this.ensureSecaMemorySchema())) {
      return 0;
    }

    let updated = 0;

    for (const reference of references) {
      try {
        await this.weaviateClient.data.merger()
          .withClassName(reference.className)
          .withId(reference.objectId)
          .withProperties({
            poor_match_count: reference.poorMatchCount + 1,
            review_decision: reference.poorMatchCount + 1 >= 3 ? 'needs_sleep_review' : 'unreviewed',
            review_reason: 'Retrieved but not injected into voice context.'
          })
          .do();
        updated += 1;
      } catch (error: any) {
        console.warn(`SECA RAG poor-match feedback skipped for ${reference.objectId}: ${error?.message || error}`);
      }
    }

    return updated;
  }

  private mapSecaMemoryCandidate(
    source: 'archived_conversation' | 'curated_memory',
    className: SecaMemoryClassName,
    memory: RetrievedSecaMemory
  ): SecaMemoryCleanupCandidate | null {
    const objectId = memory._additional?.id;
    if (!objectId) {
      return null;
    }

    return {
      source,
      className,
      objectId,
      score: this.toNumber(memory.last_similarity_score ?? memory._additional?.score, 0),
      retrievalCount: this.toNumber(memory.retrieval_count, 0),
      poorMatchCount: this.toNumber(memory.poor_match_count, 0),
      content: memory.memory_text || memory.content,
      createdDttm: memory.created_dttm,
      lastRetrievedDttm: memory.last_retrieved_dttm,
      lastReviewedDttm: memory.last_reviewed_dttm,
      reviewDecision: memory.review_decision,
      reviewReason: memory.review_reason,
      reviewCooldownUntil: memory.review_cooldown_until
    };
  }

  async getSecaMemoryCleanupCandidates(sessionId: number, userId: number, limit = 3, poolLimit = 80): Promise<SecaMemoryCleanupCandidate[]> {
    if (!(await this.ensureSecaMemorySchema())) {
      return [];
    }

    try {
      const where = {
        operator: 'Equal',
        path: ['session_id'],
        valueInt: sessionId
      };

      const [archivedResponse, curatedResponse] = await Promise.all([
        this.weaviateClient.graphql
          .get()
          .withClassName(SECA_ARCHIVED_CONVERSATION_CLASS)
          .withFields('original_conversation_id session_id user_id role tag content created_dttm retrieval_count poor_match_count last_similarity_score last_retrieved_dttm last_reviewed_dttm review_decision review_reason review_cooldown_until _additional { id }')
          .withWhere(where)
          .withLimit(poolLimit)
          .do(),
        this.weaviateClient.graphql
          .get()
          .withClassName(SECA_CURATED_MEMORY_CLASS)
          .withFields('session_id user_id memory_text emotional_weight retrieval_keywords should_retrieve_when source_conversation_ids created_dttm retrieval_count poor_match_count last_similarity_score last_retrieved_dttm last_reviewed_dttm review_decision review_reason review_cooldown_until _additional { id }')
          .withWhere(where)
          .withLimit(poolLimit)
          .do()
      ]);

      const archived = ((archivedResponse.data?.Get?.[SECA_ARCHIVED_CONVERSATION_CLASS] || []) as RetrievedSecaMemory[])
        .map(memory => this.mapSecaMemoryCandidate('archived_conversation', SECA_ARCHIVED_CONVERSATION_CLASS, memory));
      const curated = ((curatedResponse.data?.Get?.[SECA_CURATED_MEMORY_CLASS] || []) as RetrievedSecaMemory[])
        .map(memory => this.mapSecaMemoryCandidate('curated_memory', SECA_CURATED_MEMORY_CLASS, memory));
      const now = Date.now();

      return [...archived, ...curated]
        .filter((candidate): candidate is SecaMemoryCleanupCandidate => candidate !== null)
        .filter(candidate => {
          const cooldownUntil = candidate.reviewCooldownUntil ? new Date(candidate.reviewCooldownUntil).getTime() : 0;
          const cooldownExpired = !Number.isFinite(cooldownUntil) || cooldownUntil <= now;
          const wasKept = candidate.reviewDecision === 'keep';
          const repeatedlyPoor = candidate.poorMatchCount >= (wasKept ? 5 : 3);
          const repeatedLowScore = !wasKept && candidate.retrievalCount >= 3 && candidate.score <= 0.1;
          return cooldownExpired && (repeatedlyPoor || repeatedLowScore);
        })
        .sort((a, b) => {
          const poorDelta = b.poorMatchCount - a.poorMatchCount;
          if (poorDelta !== 0) {
            return poorDelta;
          }

          const reviewedA = a.lastReviewedDttm ? new Date(a.lastReviewedDttm).getTime() : 0;
          const reviewedB = b.lastReviewedDttm ? new Date(b.lastReviewedDttm).getTime() : 0;
          if (reviewedA !== reviewedB) {
            return reviewedA - reviewedB;
          }

          const scoreDelta = a.score - b.score;
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          return b.retrievalCount - a.retrievalCount;
        })
        .slice(0, limit);
    } catch (error: any) {
      console.warn(`SECA RAG cleanup candidate lookup skipped: ${error?.message || error}`);
      return [];
    }
  }

  async markSecaMemoryReviewed(
    candidate: SecaMemoryReference,
    decision: 'keep' | 'delete' | 'unsure',
    reason: string,
    cooldownHours = 72
  ): Promise<void> {
    if (!(await this.ensureSecaMemorySchema())) {
      return;
    }

    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000).toISOString();

    await this.weaviateClient.data.merger()
      .withClassName(candidate.className)
      .withId(candidate.objectId)
      .withProperties({
        last_reviewed_dttm: now.toISOString(),
        review_decision: decision,
        review_reason: reason.slice(0, 700),
        review_cooldown_until: cooldownUntil
      })
      .do();
  }

  async deleteSecaMemoryObject(candidate: SecaMemoryReference): Promise<void> {
    if (![SECA_ARCHIVED_CONVERSATION_CLASS, SECA_CURATED_MEMORY_CLASS].includes(candidate.className)) {
      throw new Error(`Unsupported SECA memory class ${candidate.className}`);
    }

    await this.weaviateClient.data.deleter()
      .withClassName(candidate.className)
      .withId(candidate.objectId)
      .do();
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

async getSafetyRecords(sessionId: number, limit = 100): Promise<SafetyRecord[]> {
  const sql = `
    SELECT safety_record_id, session_id, user_id, content, created_dttm
    FROM safety_records
    WHERE session_id = ?
    ORDER BY safety_record_id DESC
    LIMIT ?;
  `;
  const [rows] = await this.db.execute<SafetyRecord>(sql, [sessionId, limit]);
  return rows;
}


async runPlayspaceSql(sql: string): Promise<any> {
  // single call; returns rows for SELECT, OkPacket for others
  const [rows] = await this.db.query(sql);
  return rows;
}



}
