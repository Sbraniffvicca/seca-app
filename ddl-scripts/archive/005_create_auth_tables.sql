-- Use the target database
USE valve;

-- Temporarily disable foreign key checks to avoid dependency issues
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- Drop Tables in Dependency Order
-- =========================
DROP TABLE IF EXISTS auth_tokens;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- Table: auth_tokens
-- Stores session state
-- =========================
CREATE TABLE auth_tokens (
    token_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique identifier for the token
    customer_id INT NOT NULL,                -- Links the token to a specific customer
    jwt_token TEXT NOT NULL,                 -- The signed JWT
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When the token was issued
    expires_at TIMESTAMP NOT NULL,           -- Expiration time for the token
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
