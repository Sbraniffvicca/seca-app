-- Use the target database
USE chat;


-- =========================
-- Cleanup Existing Data
-- =========================
SET FOREIGN_KEY_CHECKS = 0; -- Temporarily disable foreign key checks to avoid dependency issues

truncate table sessions;
TRUNCATE TABLE conversations;
TRUNCATE TABLE AUTH_TOKENS;
truncate table users;


-- create testuser@gmail, and give it an initial session and other data
-- testuser@gmail.com has 2 sessions, session_id 1 being the active session
insert into sessions ( session_owner_user_id, session_desc )
values (1, 'Test Load Session with sessionid = 1');

insert into sessions ( session_owner_user_id, session_desc )
values (1, 'Test Load Session with sessionid = 2');

-- users
-- the bcrypt of psswrd is password123
INSERT INTO users (role, email, password, active_session_id, rag_mode, first_nm, last_nm, address, phone, postal_cd) VALUES 
('user', 'testuser@gmail.com', '$2a$10$9gKsf0BIHc6g7TH2pGQnQeKieiAD5I6BMB.16/d9875fqnmpIRM3O', 1, 'rag_off', 'Jane', 'Doe', '-', '555-5555', 'AT456');

-- put sbraniffvicca@gmail.com 12 and jackthecat@gmail.com 7 into the same role_id 1 HR Team
insert into user_roles (user_id, role_id) values (12,1);
insert into user_roles (user_id, role_id) values (12,2);
insert into user_roles (user_id, role_id) values (12,3);
insert into user_roles (user_id, role_id) values (12,4);


insert into user_roles (user_id, role_id) values (7,1);
insert into user_roles (user_id, role_id) values (7,2);
insert into user_roles (user_id, role_id) values (7,3);

-- session 18 is the initial session for sbraniffvicca@gmail.com, put it into the HR Team role
update sessions set role_id = 1 where session_id = 18;

-- because jackthecat is in role_id 1, they decided to add session18 to their enabled sessions;
insert into user_rolesessions (user_id, session_id, seq) values (7,18,1);
insert into user_rolesessions (user_id, session_id, seq) values (12,18,1);

-- SELECT * FROM view_enabled_rolesessions WHERE user_id = ? ORDER BY seq;

SET FOREIGN_KEY_CHECKS = 1; -- Re-enable foreign key checks
