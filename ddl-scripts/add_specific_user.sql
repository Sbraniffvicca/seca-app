SET @email := 'emontgomery@teksystems.ca';
SET @first_nm := 'Emily';
SET @last_nm := 'M';
SET @password := '$2a$10$9gKsf0BIHc6g7TH2pGQnQeKieiAD5I6BMB.16/d9875fqnmpIRM3O';
SET @session_desc := CONCAT('Initial Session ', @email);


-- update users set password = '$2a$10$9gKsf0BIHc6g7TH2pGQnQeKieiAD5I6BMB.16/d9875fqnmpIRM3O' where user_id = 14;
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


-- finally Delete existing user
DELETE FROM users WHERE email = @email;

-- Insert new user
INSERT INTO users (role, email, password, active_session_id, rag_mode, first_nm, last_nm, address, phone, postal_cd)
VALUES ('user', @email, @password, NULL, 'rag_off', @first_nm, @last_nm, '-', '555-5555', 'AT456');

-- Get user_id
SELECT @user_id := user_id FROM users WHERE email = @email;

-- everyone starts in the all staff role as a bare minimum
insert into user_roles (user_id, role_id) values (@user_id,4);

-- Insert session
INSERT INTO sessions (session_owner_user_id, session_desc)
VALUES (@user_id, @session_desc);

-- Get session_id
SELECT @session_id := session_id FROM sessions WHERE session_desc = @session_desc;

-- Update user with session
UPDATE users SET active_session_id = @session_id WHERE email = @email;

-- Optional: Show final user and session
-- SELECT * FROM users WHERE email = @email;
-- SELECT * FROM sessions WHERE session_id = @session_id;


-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
