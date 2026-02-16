-- ============================================================
-- Game Platform Database Schema
-- PostgreSQL Syntax
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    email           VARCHAR(255)    UNIQUE,
    username        VARCHAR(100)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255),               -- NULL if user only uses OAuth2
    avatar_url      VARCHAR(512),
    enabled         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);

-- ============================================================
-- 2. ROLES
-- ============================================================
CREATE TABLE roles (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(50)     NOT NULL UNIQUE,
    description     VARCHAR(255)
);

-- Seed default roles
INSERT INTO roles (name, description) VALUES
    ('ROLE_USER',       'Default role for registered users'),
    ('ROLE_MODERATOR',  'Can moderate rooms and ban users'),
    ('ROLE_ADMIN',      'Full system access');

-- ============================================================
-- 3. PERMISSIONS (granular access control)
-- ============================================================
CREATE TABLE permissions (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL UNIQUE,
    description     VARCHAR(255)
);

-- Seed default permissions
INSERT INTO permissions (name, description) VALUES
    ('room:create',     'Create a new game room'),
    ('room:delete',     'Delete any game room'),
    ('user:ban',        'Ban a user from the platform'),
    ('user:view',       'View user profiles'),
    ('match:view',      'View match history'),
    ('admin:dashboard', 'Access admin dashboard');

-- ============================================================
-- 4. USER_ROLES (Many-to-Many)
-- ============================================================
CREATE TABLE user_roles (
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         INTEGER         NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMP       NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- ============================================================
-- 5. ROLE_PERMISSIONS (Many-to-Many)
-- ============================================================
CREATE TABLE role_permissions (
    role_id         INTEGER         NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id   INTEGER         NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Assign default permissions to roles
-- ROLE_USER (id=1): room:create, user:view, match:view
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (1, 1), -- room:create
    (1, 4), -- user:view
    (1, 5); -- match:view

-- ROLE_MODERATOR (id=2): inherits USER + room:delete, user:ban
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (2, 1), -- room:create
    (2, 2), -- room:delete
    (2, 3), -- user:ban
    (2, 4), -- user:view
    (2, 5); -- match:view

-- ROLE_ADMIN (id=3): all permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (3, 6);

-- ============================================================
-- 6. SOCIAL_ACCOUNTS (OAuth2 / 3rd party login)
-- ============================================================
CREATE TABLE social_accounts (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        VARCHAR(50)     NOT NULL,   -- 'GOOGLE', 'FACEBOOK', 'GITHUB'
    provider_id     VARCHAR(255)    NOT NULL,   -- ID returned by the provider
    email           VARCHAR(255),
    name            VARCHAR(255),
    avatar_url      VARCHAR(512),
    access_token    TEXT,
    refresh_token   TEXT,
    token_expiry    TIMESTAMP,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_provider_provider_id UNIQUE (provider, provider_id)
);

CREATE INDEX idx_social_accounts_user_id ON social_accounts (user_id);
CREATE INDEX idx_social_accounts_provider ON social_accounts (provider, provider_id);

-- ============================================================
-- 7. MATCH_HISTORY
-- ============================================================
CREATE TYPE game_type_enum AS ENUM ('CARO', 'CHESS', 'XIANGQI', 'UNO', 'LOTO');

CREATE TABLE match_history (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_type       game_type_enum  NOT NULL,
    room_id         VARCHAR(100),
    winner_id       BIGINT          REFERENCES users(id) ON DELETE SET NULL,  -- NULL = draw
    start_time      TIMESTAMP       NOT NULL DEFAULT NOW(),
    end_time        TIMESTAMP,
    metadata        JSONB           DEFAULT '{}'::JSONB   -- moves, chat log, scores, etc.
);

CREATE INDEX idx_match_history_game_type ON match_history (game_type);
CREATE INDEX idx_match_history_winner ON match_history (winner_id);
CREATE INDEX idx_match_history_start_time ON match_history (start_time DESC);

-- ============================================================
-- 8. MATCH_PLAYERS (players in each match)
-- ============================================================
CREATE TABLE match_players (
    match_id        UUID            NOT NULL REFERENCES match_history(id) ON DELETE CASCADE,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team            VARCHAR(50),    -- e.g., 'RED', 'BLACK' for chess/xiangqi
    score           INTEGER         DEFAULT 0,
    PRIMARY KEY (match_id, user_id)
);

-- ============================================================
-- 9. REFRESH_TOKENS (for JWT refresh flow)
-- ============================================================
CREATE TABLE refresh_tokens (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(512)    NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    revoked         BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens (token);

-- ============================================================
-- TRIGGER: Auto-update `updated_at` on users table
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
