-- Drop the admin user if it already exists
DROP USER IF EXISTS 'valve_admin_user'@'localhost';

-- Create the admin user
CREATE USER 'valve_admin_user'@'localhost' IDENTIFIED BY 'lol';

-- Grant all privileges on the valve database to the admin user
GRANT ALL PRIVILEGES ON valve.* TO 'valve_admin_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;
