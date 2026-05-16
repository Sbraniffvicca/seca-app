SET @email := 'test2@gmail.com';

use chat;

-- Temporarily disable foreign key checks to avoid dependency issues
SET FOREIGN_KEY_CHECKS = 0;

-- Retrieve the user_id for the specified email
SELECT @user_id := user_id FROM users WHERE email = @email;

-- Delete related records in the auth_tokens table
DELETE FROM auth_tokens WHERE user_id = @user_id;
Delete from conversations where user_id = @user_id; 
DELETE FROM sessions WHERE session_owner_user_id = @user_id;
DELETE FROM users WHERE user_id = @user_id;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
