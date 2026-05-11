-- Faro AI Web-Research Dataset Agent tables
-- Run against your existing faro_db database

USE faro_db;

CREATE TABLE IF NOT EXISTS faro_dataset_records (
  id CHAR(36) PRIMARY KEY,

  category ENUM(
    'city_economic_data',
    'business_ecosystem',
    'grants_funding',
    'policy_incentives',
    'cost_relocation_data'
  ) NOT NULL,

  title       VARCHAR(255) NOT NULL,
  location    VARCHAR(255),
  city        VARCHAR(150),
  state       VARCHAR(150),
  country     VARCHAR(150),

  description TEXT,
  data        JSON NOT NULL,

  source_url  TEXT NOT NULL,
  source_name VARCHAR(255),

  date_fetched   DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_verified  DATETIME DEFAULT CURRENT_TIMESTAMP,

  confidence_score DECIMAL(5,2),
  confidence_level ENUM('high', 'medium', 'low') DEFAULT 'low',
  status ENUM('active', 'expired', 'needs_review', 'rejected') DEFAULT 'needs_review',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_category     (category),
  INDEX idx_city_state   (city, state),
  INDEX idx_status       (status),
  INDEX idx_last_verified(last_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faro_source_logs (
  id         CHAR(36) PRIMARY KEY,
  record_id  CHAR(36),
  source_url TEXT NOT NULL,
  raw_text   LONGTEXT,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES faro_dataset_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
