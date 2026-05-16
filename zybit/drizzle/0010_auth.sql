-- Invite-only auth: users, magic-link tokens, sessions
CREATE TABLE IF NOT EXISTS "app_users" (
  "id"              text PRIMARY KEY,
  "email"           text NOT NULL,
  "organization_id" text NOT NULL,
  "role"            text NOT NULL DEFAULT 'member',
  "status"          text NOT NULL DEFAULT 'approved',
  "created_at"      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "app_users_email_idx"  ON "app_users" ("email");
CREATE        INDEX IF NOT EXISTS "app_users_org_idx"    ON "app_users" ("organization_id");

CREATE TABLE IF NOT EXISTS "auth_magic_links" (
  "id"          text PRIMARY KEY,
  "email"       text NOT NULL,
  "token_hash"  text NOT NULL,
  "expires_at"  timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "auth_magic_links_token_hash_idx" ON "auth_magic_links" ("token_hash");
CREATE        INDEX IF NOT EXISTS "auth_magic_links_email_idx"      ON "auth_magic_links" ("email");

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id"          text PRIMARY KEY,
  "user_id"     text NOT NULL,
  "token_hash"  text NOT NULL,
  "expires_at"  timestamptz NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_token_hash_idx" ON "auth_sessions" ("token_hash");
CREATE        INDEX IF NOT EXISTS "auth_sessions_user_idx"       ON "auth_sessions" ("user_id");
