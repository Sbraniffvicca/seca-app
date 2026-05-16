-- Use the target database
USE valve;

-- Temporarily disable foreign key checks to avoid dependency issues
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- Drop Tables in Dependency Order
-- =========================
DROP TABLE IF EXISTS customer_bikes;
DROP TABLE IF EXISTS cust_profiles;
DROP TABLE IF EXISTS profile_types;
DROP TABLE IF EXISTS terrain_types;
DROP TABLE IF EXISTS skill_types;
DROP TABLE IF EXISTS basebikes;
DROP TABLE IF EXISTS customers;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- Table: customers
-- Stores customer information
-- =========================
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY, -- tech-pkey: unique customer ID
    email VARCHAR(255) NOT NULL UNIQUE,        -- bus-skey: human-readable email
    first_nm VARCHAR(50) NOT NULL,             -- Customer's first name
    last_nm VARCHAR(50) NOT NULL,              -- Customer's last name
    address VARCHAR(255),                      -- Customer's address
    phone VARCHAR(20),                         -- Customer's phone number
    postal_cd VARCHAR(20),                     -- Customer's postal code
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP -- Row update timestamp
);

-- =========================
-- Table: terrain_types
-- Lookup table for terrain types (e.g., rough, smooth)
-- =========================
CREATE TABLE terrain_types (
    terrain_type_id INT AUTO_INCREMENT PRIMARY KEY, -- tech-pkey
    terrain_type VARCHAR(50) NOT NULL UNIQUE        -- bus-skey: terrain descriptor
);


-- =========================
-- Table: skill_types
-- Lookup table for skill levels (e.g., beginner, pro)
-- =========================
CREATE TABLE skill_types (
    skill_type_id INT AUTO_INCREMENT PRIMARY KEY, -- tech-pkey
    skill_type VARCHAR(50) NOT NULL UNIQUE        -- bus-skey: skill level descriptor
);


-- =========================
-- Table: profile_types
-- Stores customer profile information
-- =========================
CREATE TABLE profile_types (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,    -- tech-pkey
    profile_type VARCHAR(50) NOT NULL UNIQUE,     -- bus-skey: profile descriptor
    terrain_type_id INT NOT NULL,                 -- Foreign key to terrain_types
    skill_type_id INT NOT NULL,                   -- Foreign key to skill_types
    FOREIGN KEY (terrain_type_id) REFERENCES terrain_types(terrain_type_id),
    FOREIGN KEY (skill_type_id) REFERENCES skill_types(skill_type_id)
);

-- =========================
-- Table: cust_profiles
-- Customer 1:N relationship with profiles
-- =========================
CREATE TABLE cust_profiles (
    customer_id INT NOT NULL,                     -- tech-pkey1: part 1
    profile_id INT NOT NULL,                      -- tech-pkey1: part 2
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (customer_id, profile_id),        -- Composite primary key
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (profile_id) REFERENCES profile_types(profile_id)
);

-- =========================
-- Table: basebikes
-- Stores information about base bikes
-- =========================
CREATE TABLE basebikes (
    basebike_id INT AUTO_INCREMENT PRIMARY KEY,   -- tech-pkey
    make VARCHAR(50) NOT NULL,                    -- bus-skey1: part 1
    model VARCHAR(50) NOT NULL,                   -- bus-skey1: part 2
    year YEAR NOT NULL,                           -- bus-skey1: part 3
    weight INT NOT NULL,                          -- Base weight
    weight_addons INT,                            -- Add-on weight
    weight_bias INT,                              -- Weight bias
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    UNIQUE (make, model, year)                    -- Composite unique constraint
);

-- =========================
-- Table: customer_bikes
-- Customer 1:N relationship with bikes
-- =========================
CREATE TABLE customer_bikes (
    customer_id INT NOT NULL,                     -- pkey1: part 1
    customerbike_seq INT NOT NULL,                -- pkey1: part 2 (sequence number)
    basebike_id INT NOT NULL,                     -- Foreign key to basebikes
    cstmzd_weight INT,                            -- Customized weight
    cstmzd_weight_addons INT,                     -- Customized weight with addons
    cstmzd_weight_bias INT,                       -- Customized weight bias
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (customer_id, customerbike_seq),  -- Composite primary key
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (basebike_id) REFERENCES basebikes(basebike_id)
);
