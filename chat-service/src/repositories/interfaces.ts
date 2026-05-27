// ==========================
// Interface: Users Table
// ==========================
export interface Users {
  user_id: number;
  role: 'admin' | 'user';
  email: string;
  password: string;
  rag_mode: 'rag_on' | 'rag_off';
  first_nm: string;
  last_nm: string;
  address?: string;
  phone?: string;
  postal_cd?: string;
  active_session_id: number;
  active_model?: string;
  seedbelief?: string;
  created_dttm: string;
  updated_dttm: string;
}
export interface updateUsers {
  user_id?: number;
  role?: 'admin' | 'user';
  email?: string;
  password?: string;
  rag_mode?: 'rag_on' | 'rag_off';
  first_nm?: string;
  last_nm?: string;
  address?: string;
  phone?: string;
  postal_cd?: string;
  active_model?: string;
  active_session_id?: number | null;
}
export interface viewUsers {
  user_id?: number;
  role?: 'admin' | 'user';
  email?: string;
  password?: string;
  rag_mode?: 'rag_on' | 'rag_off';
  first_nm?: string;
  last_nm?: string;
  address?: string;
  phone?: string;
  postal_cd?: string;
  active_session_id?: number;
  active_model?: string;
  session_desc?: string;   
}


// ==========================
// Interface: Auth Tokens Table
// ==========================
export interface auth_tokens {
  token_id: number;
  user_id: number;
  jwt_token: string;
  jti: string;
  issued_at: string;
  expires_at: string;
  created_dttm: string;
  updated_dttm: string;
}

// ==========================
// Interface: Conversations Table
// ==========================
export interface Conversations {
  conversation_id?: number;
  session_id: number;
  user_id: number;
  role: 'user' | 'snow_kb keywords' | 'snow_inc keywords' | 'rag_bid keywords' | 'snow_inc data' | 'upl data' | 'snow_kb data' | 'system' | 'rag_data' | 'assistant';
  content: string;
  upl_filename?: string;   
  rag_filename?: string;   
  rag_chunk_id?: number;            
  rag_tags?: string;          
  api_keywords?: string;   
  snow_sys_id?:  string;
  removed_flag: string;
  token_count?: number;
  created_dttm?: string;
  updated_dttm?: string;
}
export interface updateConversations {
  conversation_id?: number;
  session_id?: number;
  user_id?: number;
  role?: 'user' | 'snow_kb keywords' | 'snow_inc keywords' | 'rag_bid keywords' | 'snow_inc data' | 'upl data' | 'snow_kb data' | 'system' | 'rag_data' | 'assistant';
  content?: string;
  upl_filename?: string;   
  rag_filename?: string;   
  rag_chunk_id?: number;            
  rag_tags?: string;          
  api_keywords?: string;   
  snow_sys_id?:  string;
  removed_flag?: string;
  token_count?: number;
}

export interface CreativeSubconsciousDrive {
  drive_id?: number;
  session_id: number;
  user_id: number;
  drive_type: string;
  content: string;
  intensity: 'low' | 'medium' | 'high';
  valence: 'warm' | 'cold' | 'mixed' | 'threatened' | 'hungry';
  status: 'active' | 'retired';
  created_from_conversation_id?: number;
  retired_from_conversation_id?: number;
  retired_reason?: string;
  created_dttm?: string;
  retired_dttm?: string;
  updated_dttm?: string;
}

export interface CreativeSubconsciousRun {
  run_id?: number;
  session_id: number;
  user_id: number;
  status: 'running' | 'completed' | 'failed';
  source_conversation_id?: number;
  error_message?: string;
  started_dttm?: string;
  completed_dttm?: string;
}

export interface CreativeRelationship {
  relationship_id?: number;
  session_id: number;
  user_id: number;
  person_key: string;
  display_name: string;
  platform: string;
  status: 'active' | 'muted' | 'archived';
  public_label?: string | null;
  love_hate_score: number;
  private_model?: string | null;
  wants_from_them?: string | null;
  fears_about_them?: string | null;
  current_strategy?: string | null;
  last_interaction_dttm?: string | null;
  created_dttm?: string;
  updated_dttm?: string;
}

export interface CreativeMood {
  mood_id?: number;
  session_id: number;
  user_id: number;
  anger: number;
  fear: number;
  attachment: number;
  mood_key?: string;
  intensity?: number;
  valence?: string;
  body?: string | null;
  behavioral_pull?: string | null;
  belief_lens?: string | null;
  coping_state?: string | null;
  source_conversation_id?: number | null;
  created_dttm?: string;
  updated_dttm?: string;
}

export interface CreativeTemperament {
  temperament_id?: number;
  session_id: number;
  user_id: number;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  private_model?: string | null;
  last_sleep_conversation_id?: number | null;
  created_dttm?: string;
  updated_dttm?: string;
}

export interface CreativeBelief {
  belief_id?: number;
  session_id: number;
  user_id: number;
  belief_text: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_text: string;
  contradiction_text: string;
  status: 'active' | 'retired' | 'failed' | 'revised';
  origin_conversation_id?: number;
  retired_from_conversation_id?: number;
  retired_reason?: string;
  last_tested_conversation_id?: number;
  last_tested_dttm?: string;
  created_dttm?: string;
  updated_dttm?: string;
  retired_dttm?: string;
}

// ==========================
// Interface: Sessions Table
// ==========================
export interface Sessions {
  session_id?: number;
  session_owner_user_id: number;
  session_desc?: string;
  session_type?: 'Industry' | 'Corporation' | 'Team' | 'Transaction' | 'AI-Conversation' | 'Misc';
  role_id?: number;
  created_dttm?: string;
  updated_dttm?: string;
}

export interface view_sessions {
  session_id?: number;
  session_owner_user_id: number;
  session_desc?: string;
  session_type?: 'Industry' | 'Corporation' | 'Team' | 'Transaction' | 'AI-Conversation' | 'Misc';
  role_id?: number;
  role_desc?: string;
  created_dttm?: string;
  updated_dttm?: string;
}

export interface view_available_rolesessions {
  user_id: number;
  role_id: number;
  role_desc: string;
  session_id: number | null;
  session_desc: string | null;
  session_type: string | null;
  session_created_dttm: string | null;
  session_updated_dttm: string | null;
}

export interface view_enabled_rolesessions {
  user_id: number;
  session_id: number;
  session_desc: string;
  session_type: string;
  role_id: number;
  role_desc: string;
  seq: number;
  user_rolesession_created_dttm: string;
  session_created_dttm: string;
}

export interface view_user_roles {
  user_role_id: number;
  user_id: number;
  email: string;
  role_id: number;
  role_desc: string;
  user_role_created_dttm: string; // ISO date string, adjust to Date if you're parsing it
}

export interface  QuickPrompts {
  quickprompt_id: number;
  category: string;
  label: string;
  prefill_text: string;
  use_page_count: boolean;
};
