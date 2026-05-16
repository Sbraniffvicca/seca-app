import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { Conversations, updateConversations, auth_tokens, Users, viewUsers, updateUsers, Sessions } from './interfaces';

@Injectable()
export class AuthRepository {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}


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

  async insertAuthToken(userId: number, jti: string, authToken: string): Promise<void> {
    console.log('repolayer insertauthtoken start');
    const query = `
      INSERT INTO auth_tokens (user_id, jwt_token, jti, issued_at, expires_at)
      VALUES (?, ?, ?, now(), DATE_ADD(NOW(), INTERVAL 7 DAY));
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
