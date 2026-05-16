-- Use the target database
USE valve;

-- Temporarily disable foreign key checks to avoid dependency issues
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- Drop Tables in Dependency Order
-- =========================
-- first the lookups
DROP TABLE IF EXISTS manu_forks;
DROP TABLE IF EXISTS manufork_specs;
DROP TABLE IF EXISTS manufork_recomsettings;

-- second the customer (ie tenant) tables
DROP TABLE IF EXISTS forks;
DROP TABLE IF EXISTS fork_hists;
DROP TABLE IF EXISTS fork_settings;   -- 1to1 with forks but separated for intuitive model
DROP TABLE IF EXISTS forksetting_hists;
DROP TABLE IF EXISTS fork_services;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

--
-- first the reference tables
--

CREATE TABLE manu_forks (
    manufork_id INT AUTO_INCREMENT,        	      -- Primary key
    manufacturerbike_id INT NOT NULL,                -- Foreign key to manufacturer_bikes
    manufacturer_name VARCHAR(255) NOT NULL,          -- Manufacturer name
    model_name VARCHAR(255) NOT NULL,                 -- Fork model name
    weight INT,                                       -- Weight of the fork in grams
    material VARCHAR(255),                            -- Material of the fork (e.g., aluminum, carbon)
    suspension_type VARCHAR(255),                     -- Suspension type (e.g., telescopic, USD)
    travel INT,                                       -- Travel range in mm
    stanchion_diameter INT,                           -- Diameter of the stanchions in mm
    axle_type VARCHAR(255),                           -- Type of axle (e.g., quick-release, thru-axle)
    offset INT,                                       -- Fork offset measurement in mm
    brake_mount_type VARCHAR(255),                    -- Brake mount type (e.g., Post-Mount, Flat-Mount)
    max_rotor_size INT,                               -- Maximum brake rotor size in mm
    recommended_oil VARCHAR(255),                     -- Recommended suspension oil type and weight
    recommended_air_pressure INT,                     -- Recommended air pressure for air-spring forks
    damping_system VARCHAR(255),                      -- Type of damping system (e.g., twin-tube, mono-tube)
    warranty_period INT,                              -- Warranty period in months
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (manufork_id),
    UNIQUE (manufacturer_name, model_name),           -- Ensures unique fork models by manufacturer
    FOREIGN KEY (manufacturerbike_id) REFERENCES manufacturer_bikes(manufacturerbike_id) -- Links to parent bike
);

CREATE TABLE manufork_specs (
    manuforkspec_id INT AUTO_INCREMENT,       -- Primary key
    manufork_id INT NOT NULL,                  -- Foreign key to manufacturerbike_fork
    basevalvetype VARCHAR(255),                        -- Type of base valve
    midvalvetype VARCHAR(255),                         -- Type of mid valve
    icsspringrate DECIMAL(5,2),                        -- ICS spring rate
    droddiameter DECIMAL(5,2),                         -- Damper rod diameter in mm
    size VARCHAR(50),                                  -- Physical size or classification of the fork
    travel INT,                                        -- Travel range in mm
    damper_type VARCHAR(255),                          -- Type of damper system (e.g., air, coil)
    comp_adjust_range VARCHAR(255),                    -- Compression adjustment range
    reb_adjust_range VARCHAR(255),                     -- Rebound adjustment range
    stanchion_diameter INT,                            -- Stanchion tube diameter in mm
    axle_config VARCHAR(255),                          -- Axle configuration (e.g., quick-release, thru-axle)
    offset INT,                                        -- Fork offset in mm
    brake_mount_type VARCHAR(255),                     -- Brake mount type (e.g., Post-Mount, Flat-Mount)
    max_rotor_size INT,                                -- Maximum rotor size in mm
    travel_adjustable BOOLEAN DEFAULT FALSE,           -- Indicates if travel is adjustable
    recommended_oil VARCHAR(255),                      -- Recommended suspension oil type and weight
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (manuforkspec_id),
    FOREIGN KEY (manufork_id) REFERENCES manu_forks(manufork_id) -- Links to manufacturers_fork
);

CREATE TABLE manufork_recomsettings (
    manuforkrecomsetting_id INT AUTO_INCREMENT,       -- Primary key
    manufork_id INT NOT NULL,                    -- Foreign key to manufacturers_fork
    cartridge VARCHAR(255),                              -- Recommended cartridge type
    cartridge_rod_dia DECIMAL(5,2),                      -- Recommended cartridge rod diameter
    cartridge_charge VARCHAR(255),                      -- Recommended cartridge charge
    BV_piston VARCHAR(255),                              -- Recommended base valve piston
    MV_piston VARCHAR(255),                              -- Recommended mid valve piston
    spring_rate DECIMAL(5,2),                            -- Recommended spring rate
    ICS_spring_rate DECIMAL(5,2),                        -- Recommended ICS spring rate
    preload_setting DECIMAL(5,2),                        -- Recommended preload adjustment (mm)
    low_speed_comp DECIMAL(5,2),                         -- Recommended low-speed compression damping
    high_speed_comp DECIMAL(5,2),                        -- Recommended high-speed compression damping
    low_speed_reb DECIMAL(5,2),                          -- Recommended low-speed rebound damping
    high_speed_reb DECIMAL(5,2),                         -- Recommended high-speed rebound damping
    air_pressure INT,                                    -- Recommended air pressure (PSI) for air-spring forks
    sag_percentage DECIMAL(5,2),                         -- Recommended sag percentage
    clicker_positions INT,                               -- Recommended number of clicks for adjustments
    damping_oil_volume DECIMAL(5,2),                     -- Recommended damping oil volume (ml)
    use_case VARCHAR(255),                               -- Intended use case (e.g., race, comfort, trail)
    recommended_weight_range VARCHAR(50),                -- Recommended rider weight range (e.g., "70-90kg")
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (manuforkrecomsetting_id),
    FOREIGN KEY (manufork_id) REFERENCES manu_forks(manufork_id) 
);

--
-- now the customer (non reference) tables
--

CREATE TABLE forks (
    fork_id INT AUTO_INCREMENT,                      -- Primary key
    custbike_id INT NOT NULL,                           -- Foreign key to cust_bike (true parent)
    forklocation ENUM('Front', 'Rear') NOT NULL,            -- Indicates front or rear fork
    manufork_id INT NOT NULL,                    -- Foreign key to manufacturers_fork
    installation_date DATE,                              -- Date the fork was installed
    recommended_service_interval INT,                   -- Suggested service interval in hours or kilometers
    last_service_date DATE,                              -- Date the fork was last serviced
    last_service_notes TEXT,                             -- Notes from the most recent service
    rider_weight INT,                                    -- Rider weight in kilograms or pounds
    usage_type VARCHAR(255),                             -- Primary usage of the bike (e.g., off-road, trail)
    current_mileage INT,                                 -- Total mileage with this fork installed
    customization_notes TEXT,                            -- Notes about customizations made to the fork
    fork_serial_number VARCHAR(255),                     -- Serial number of the fork
    performance_rating DECIMAL(3,2),                     -- Subjective or measured performance rating
    lastupdatedby_userid INT NOT NULL,						
    tenant_id INT NOT NULL,                              -- Tenant identifier
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,    -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (fork_id),
    UNIQUE (custbike_id, forklocation),
    FOREIGN KEY (custbike_id) REFERENCES cust_bikes(custbike_id), -- Links to parent bike
    FOREIGN KEY (manufork_id) REFERENCES manu_forks(manufork_id), -- Links to manufacturer fork data
    FOREIGN KEY (lastupdatedby_userid) REFERENCES users(user_id),    -- Links to the user (tuner) who performed the service
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) -- Links to tenant data
);

CREATE TABLE fork_hists (
    forkhist_id INT AUTO_INCREMENT,             -- Primary key
    fork_id INT NOT NULL,                           -- Foreign key to cust_bikefork
    custbike_id INT NOT NULL,                          -- Redundant link to the parent bike for quick lookups
    forklocation ENUM('Front', 'Rear') NOT NULL,            -- Indicates front or rear fork
    manubikefork_id INT NOT NULL,                   -- Redundant link to the manufacturer fork
    installation_date DATE,                             -- Date the fork was installed
    retired_dttm TIMESTAMP NOT NULL,                    -- Timestamp when the fork was retired
    recommended_service_interval INT,                   -- Suggested service interval in hours or kilometers
    last_service_date DATE,                             -- Date of the last service before retirement
    last_service_notes TEXT,                            -- Notes from the last service before retirement
    rider_weight INT,                                   -- Rider weight in kilograms or pounds
    usage_type VARCHAR(255),                            -- Primary usage of the bike (e.g., off-road, trail)
    current_mileage INT,                                -- Total mileage with this fork before retirement
    customization_notes TEXT,                           -- Notes about customizations made to the fork
    fork_serial_number VARCHAR(255),                    -- Serial number of the fork
    performance_rating DECIMAL(3,2),                    -- Performance rating before retirement
    lastupdatedby_userid INT NOT NULL,						
    tenant_id INT NOT NULL,                             -- Tenant identifier
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (forkhist_id),
    FOREIGN KEY (fork_id) REFERENCES forks(fork_id),
    FOREIGN KEY (lastupdatedby_userid) REFERENCES users(user_id),    -- Links to the user (tuner) who performed the service
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)            -- Links to tenant
);

CREATE TABLE fork_settings (
    forksetting_id INT AUTO_INCREMENT,            -- Primary key
    fork_id INT NOT NULL,                          -- Foreign key
    cartridge VARCHAR(255),                            -- Type of cartridge
    cartridge_rod_dia DECIMAL(5,2),                    -- Diameter of the cartridge rod
    cartridge_charge VARCHAR(255),                    -- Cartridge charge specification
    BV_piston VARCHAR(255),                            -- Base valve piston details
    MV_piston VARCHAR(255),                            -- Mid valve piston details
    spring_rate DECIMAL(5,2),                          -- Spring rate value
    ICS_spring_rate DECIMAL(5,2),                      -- ICS spring rate
    preload_setting DECIMAL(5,2),                      -- Preload adjustment in mm
    low_speed_comp DECIMAL(5,2),                       -- Low-speed compression damping adjustment
    high_speed_comp DECIMAL(5,2),                      -- High-speed compression damping adjustment
    low_speed_reb DECIMAL(5,2),                        -- Low-speed rebound damping adjustment
    high_speed_reb DECIMAL(5,2),                       -- High-speed rebound damping adjustment
    air_pressure INT,                                  -- Air pressure setting (PSI) for air-spring forks
    sag_percentage DECIMAL(5,2),                       -- Fork sag percentage
    clicker_positions INT,                             -- Number of clicks for adjustment systems
    damping_oil_volume DECIMAL(5,2),                   -- Volume of damping oil in milliliters
    lastupdatedby_userid INT NOT NULL,						
    tenant_id INT NOT NULL,                            -- Tenant identifier
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (forksetting_id),
    UNIQUE (fork_id),  -- this is a 1to1 table with bikefork merely to keep the model intuitive so this makes it 1to1
    FOREIGN KEY (fork_id) REFERENCES forks(fork_id), -- Links to customer-specific fork
    FOREIGN KEY (lastupdatedby_userid) REFERENCES users(user_id),    -- Links to the user (tuner) who performed the service
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)           -- Links to tenant data
);

CREATE TABLE forksetting_hists (
    forksettinghist_id INT AUTO_INCREMENT,          -- Primary key
    forksetting_id INT NOT NULL,            -- f key
    fork_id INT NOT NULL,                          
    cartridge VARCHAR(255),                            -- Type of cartridge
    cartridge_rod_dia DECIMAL(5,2),                    -- Diameter of the cartridge rod
    cartridge_charge VARCHAR(255),                    -- Cartridge charge specification
    BV_piston VARCHAR(255),                            -- Base valve piston details
    MV_piston VARCHAR(255),                            -- Mid valve piston details
    spring_rate DECIMAL(5,2),                          -- Spring rate value
    ICS_spring_rate DECIMAL(5,2),                      -- ICS spring rate
    preload_setting DECIMAL(5,2),                      -- Preload adjustment in mm
    low_speed_comp DECIMAL(5,2),                       -- Low-speed compression damping adjustment
    high_speed_comp DECIMAL(5,2),                      -- High-speed compression damping adjustment
    low_speed_reb DECIMAL(5,2),                        -- Low-speed rebound damping adjustment
    high_speed_reb DECIMAL(5,2),                       -- High-speed rebound damping adjustment
    air_pressure INT,                                  -- Air pressure setting (PSI) for air-spring forks
    sag_percentage DECIMAL(5,2),                       -- Fork sag percentage
    clicker_positions INT,                             -- Number of clicks for adjustment systems
    damping_oil_volume DECIMAL(5,2),                   -- Volume of damping oil in milliliters
    effective_date DATE NOT NULL,                      -- Date when this setting became active
    lastupdatedby_userid INT NOT NULL,						-- this is the value last in real table - hist is frozen
    tenant_id INT NOT NULL,                            -- Tenant identifier
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Timestamp when this historical record was created
    PRIMARY KEY (forksettinghist_id),
    FOREIGN KEY (forksetting_id) REFERENCES fork_settings(forksetting_id),
    FOREIGN KEY (lastupdatedby_userid) REFERENCES users(user_id),    -- Links to the user (tuner) who performed the service
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)            -- Links to tenant data
);


CREATE TABLE fork_services (
    forkservice_id INT AUTO_INCREMENT,            -- Primary key
    fork_id INT NOT NULL,                          -- Foreign key to cust_bikefork
    service_date DATE NOT NULL,                        -- Date when the service was performed
    service_type VARCHAR(255),                         -- Type of service (e.g., rebuild, maintenance, tuning)
    service_notes TEXT,                                -- Detailed notes about the service
    mileage_at_service INT,                            -- Bike mileage at the time of service
    cost DECIMAL(10,2),                                -- Cost of the service
    lastupdatedby_userid INT NOT NULL,						 
   tenant_id INT NOT NULL,                            -- Tenant identifier
    created_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Row creation timestamp
    updated_dttm TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, -- Row update timestamp
    PRIMARY KEY (forkservice_id),
    FOREIGN KEY (fork_id) REFERENCES forks(fork_id), -- Links to the specific fork
    FOREIGN KEY (lastupdatedby_userid) REFERENCES users(user_id),    -- Links to the user (tuner) who performed the service
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)            -- Links to tenant data
);
