-- Use the target database
USE chat;


-- =========================
-- Cleanup Existing Data
-- =========================
SET FOREIGN_KEY_CHECKS = 0; -- Temporarily disable foreign key checks to avoid dependency issues

truncate table roles;

INSERT INTO roles (role_desc) VALUES 
('HR Team'), ('Policy Team') , ('Legal Team'), ('All Staff'), ('Case #201');

SET FOREIGN_KEY_CHECKS = 1; -- Re-enable foreign key checks
