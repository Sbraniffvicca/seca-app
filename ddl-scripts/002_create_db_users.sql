-- do not set a database with use, this is a db user construct which is global to ALL databases in the install.

-- Drop the user if it already exists
DROP USER IF EXISTS 'chat_app_user'@'localhost';

-- Create the app-tier user
CREATE USER 'chat_app_user'@'localhost' IDENTIFIED WITH 'caching_sha2_password' BY 'Fancylol';

-- Grant CRUD privileges on the chat database
GRANT CREATE, ALTER, SELECT, INSERT, UPDATE, DELETE ON chat.* TO 'chat_app_user'@'localhost';

-- Drop the admin user if it already exists
DROP USER IF EXISTS 'chat_admin_user'@'localhost';

-- Create the admin user
CREATE USER 'chat_admin_user'@'localhost' IDENTIFIED WITH 'caching_sha2_password' BY 'Fancylol';

-- Grant all privileges on the chat database to the admin user
GRANT ALL PRIVILEGES ON chat.* TO 'chat_admin_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;