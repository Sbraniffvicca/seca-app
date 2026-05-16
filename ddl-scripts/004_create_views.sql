-- Use the target database
USE chat;

DROP VIEW IF EXISTS viewUsers;
DROP VIEW IF EXISTS view_user_roles;
DROP VIEW IF EXISTS view_available_rolesessions;
drop view if exists view_enabled_rolesessions;
drop view if exists view_sessions;

CREATE VIEW view_sessions AS
SELECT 
  s.session_id,
  s.session_owner_user_id,
  s.session_desc,
  s.session_type,
  s.role_id,
  r.role_desc,
  s.created_dttm,
  s.updated_dttm
FROM sessions s
LEFT JOIN roles r ON s.role_id = r.role_id;


CREATE VIEW viewUsers AS
SELECT 
    u.user_id,
    u.role,
    u.email,
    u.password,
    u.rag_mode,
    u.first_nm,
    u.last_nm,
    u.address,
    u.phone,
    u.postal_cd,
    u.active_session_id,
    u.active_model,
    s.session_desc,
    u.created_dttm,
    u.updated_dttm
FROM 
    users u
LEFT JOIN 
    sessions s ON u.active_session_id = s.session_id;

-- if the name of the view is view_basetablename then there must be an exact match on number of records
-- otherwise if you are screwing around such as left joins or notin then name the view weirdly to alarm devs
CREATE VIEW view_user_roles AS
SELECT 
  ur.user_role_id,
  ur.user_id,
  u.email,
  r.role_id,
  r.role_desc,
  ur.created_dttm AS user_role_created_dttm
FROM user_roles ur
JOIN roles r ON ur.role_id = r.role_id
JOIN users u ON ur.user_id = u.user_id;

CREATE VIEW view_available_rolesessions AS
SELECT 
  v.user_id,
  v.role_id,
  v.role_desc,
  s.session_id,
  s.session_desc,
  s.session_type,
  s.created_dttm AS session_created_dttm,
  s.updated_dttm AS session_updated_dttm
FROM view_user_roles v
JOIN sessions s ON s.role_id = v.role_id
WHERE NOT EXISTS (
  SELECT 1 
  FROM user_rolesessions urs 
  WHERE urs.user_id = v.user_id AND urs.session_id = s.session_id
);

CREATE or replace VIEW view_enabled_rolesessions AS
SELECT 
  urs.user_id,
  s.session_id,
  s.session_desc,
  s.session_type,
  s.role_id,
  r.role_desc,
  urs.seq,
  urs.created_dttm AS user_rolesession_created_dttm,
  s.created_dttm AS session_created_dttm
FROM user_rolesessions urs
JOIN sessions s ON urs.session_id = s.session_id
JOIN roles r ON s.role_id = r.role_id;



-- not run yet
CREATE OR REPLACE VIEW view_all_rolesessions AS
SELECT
  s.session_id,
  s.session_desc,
  s.session_type,
  s.role_id,
  r.role_desc,
  s.created_dttm,
  s.updated_dttm
FROM sessions s
JOIN roles r ON s.role_id = r.role_id
where session_type <> 'AI-Conversation';

