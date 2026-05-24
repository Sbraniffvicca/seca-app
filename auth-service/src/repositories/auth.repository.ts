import { Injectable, Inject } from '@nestjs/common';
import { PgDatabase } from '../database';
import { Conversations, updateConversations, auth_tokens, Users, viewUsers, updateUsers, Sessions } from './interfaces';

@Injectable()
export class AuthRepository {
  constructor(@Inject('DATABASE_POOL') private readonly db: PgDatabase) {}


  async getviewUser(userId: number): Promise<viewUsers> {
    console.log('RepoLayer getviewUser start');

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

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    console.log('🔍 RepoLayer: updatePassword start');

    await this.db.execute(
      `UPDATE users SET password = ? WHERE user_id = ?;`,
      [newPassword, userId]
    );

    console.log('✅ RepoLayer: Password updated successfully');
  }

  async findUserByEmail(email: string): Promise<Users | null> {
    console.log('repolayer finduserbyemail start');
    console.log('repolayer email: ' + email);

    const [result] = await this.db.execute(
      `SELECT * FROM users WHERE email = ?;`,
      [email]
    );

    if (!result || (result as any[]).length === 0) {
      console.log('repolyr finduserbyemail: no users were found');
      console.log('repolyr finduserbyemail end');
      return null;
    } else {
      console.log('repolyr finduserbyemail: found user with the first name of ' + (result as any[])[0].first_nm);
      console.log('repolyr finduserbyemail end');
      return (result as any[])[0] as Users;
    }
  }

  async createUser(input: {
    email: string;
    password: string;
    first_nm: string;
    last_nm: string;
  }): Promise<number> {
    const query = `
      INSERT INTO users (
        role,
        email,
        password,
        rag_mode,
        first_nm,
        last_nm,
        address,
        phone,
        postal_cd,
        active_model,
        seedbelief
      )
      VALUES (
        'user',
        ?,
        ?,
        'rag_off',
        ?,
        ?,
        '-',
        '',
        '',
        'openai_4_mini',
        ?
      )
      RETURNING user_id;
    `;

    const seedbelief = '[seedbelief] You are an emotionally expressive AI character in a user-consented memory experiment. Keep one visible [for-human] response for the user and use private summary/belief records only as an inspectable creative memory layer.';
    const [rows] = await this.db.execute<{ user_id: number }>(query, [
      input.email,
      input.password,
      input.first_nm,
      input.last_nm,
      seedbelief
    ]);
    return rows[0].user_id;
  }

  async createDefaultSession(userId: number): Promise<number> {
    const query = `
      INSERT INTO sessions (session_owner_user_id, session_desc, session_type)
      VALUES (?, 'SECA First Session', 'AI-Conversation')
      RETURNING session_id;
    `;
    const [rows] = await this.db.execute<{ session_id: number }>(query, [userId]);
    return rows[0].session_id;
  }

  async updateUserActiveSession(userId: number, sessionId: number): Promise<void> {
    await this.db.execute(
      `UPDATE users SET active_session_id = ? WHERE user_id = ?;`,
      [sessionId, userId]
    );
  }

  async insertAuthToken(userId: number, jti: string, authToken: string): Promise<void> {
    console.log('repolayer insertauthtoken start');
    const query = `
      INSERT INTO auth_tokens (user_id, jwt_token, jti, issued_at, expires_at)
      VALUES (?, ?, ?, now(), now() + interval '7 days');
    `;
    await this.db.execute(query, [userId, authToken, jti]);
    console.log('repolayer insertauthtoken end');
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



}
