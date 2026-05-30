import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { compare, hash } from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required for auth storage");
}

const sql = neon(DATABASE_URL);

let authReady: Promise<void> | null = null;

type AuthUserRow = {
  id: string;
  email: string;
  password_hash: string;
};

type MappingRow = {
  auth_user_id: string;
  domain_user_id: string;
  display_name: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function defaultDisplayNameFromEmail(email: string): string {
  const local = normalizeEmail(email).split("@")[0] || "traveler";
  return `旅人(${local.slice(0, 12)})`;
}

export async function ensureAuthTables(): Promise<void> {
  if (!authReady) {
    authReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS auth_users (
          id text PRIMARY KEY,
          email text NOT NULL UNIQUE,
          password_hash text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS user_profile_mappings (
          auth_user_id text PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
          domain_user_id text NOT NULL UNIQUE,
          display_name text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        ALTER TABLE user_profile_mappings
        ADD COLUMN IF NOT EXISTS display_name text
      `;
    })();
  }
  await authReady;
}

export type AuthUserRecord = {
  id: string;
  email: string;
};

export async function findAuthUserByEmail(
  email: string
): Promise<(AuthUserRecord & { passwordHash: string }) | null> {
  await ensureAuthTables();
  const rows = (await sql`
    SELECT id, email, password_hash
    FROM auth_users
    WHERE email = ${normalizeEmail(email)}
    LIMIT 1
  `) as AuthUserRow[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
  };
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUserRecord | null> {
  const user = await findAuthUserByEmail(email);
  if (!user) return null;
  const ok = await compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email };
}

export async function createAuthUser(input: {
  email: string;
  password: string;
}): Promise<AuthUserRecord | { error: string }> {
  await ensureAuthTables();
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) return { error: "invalid_email" };
  if (input.password.length < 8) return { error: "password_too_short" };

  const existing = await findAuthUserByEmail(email);
  if (existing) return { error: "email_already_used" };

  const id = `auth_${randomUUID()}`;
  const passwordHash = await hash(input.password, 12);
  await sql`
    INSERT INTO auth_users (id, email, password_hash)
    VALUES (${id}, ${email}, ${passwordHash})
  `;
  return { id, email };
}

export async function getOrCreateDomainUserIdForAuthUser(input: {
  authUserId: string;
  email: string;
}): Promise<{ domainUserId: string; displayName: string }> {
  await ensureAuthTables();
  const fallbackName = defaultDisplayNameFromEmail(input.email);
  const rows = (await sql`
    SELECT auth_user_id, domain_user_id, display_name
    FROM user_profile_mappings
    WHERE auth_user_id = ${input.authUserId}
    LIMIT 1
  `) as MappingRow[];

  if (rows[0]) {
    return {
      domainUserId: rows[0].domain_user_id,
      displayName: rows[0].display_name?.trim() || fallbackName,
    };
  }

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const domainUserId =
    adminEmail && normalizeEmail(input.email) === adminEmail
      ? "u_admin"
      : `u_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

  await sql`
    INSERT INTO user_profile_mappings (auth_user_id, domain_user_id, display_name)
    VALUES (${input.authUserId}, ${domainUserId}, ${fallbackName})
  `;

  return {
    domainUserId,
    displayName: fallbackName,
  };
}

export async function updateDomainUserDisplayName(
  domainUserId: string,
  displayName: string
): Promise<void> {
  await ensureAuthTables();
  await sql`
    UPDATE user_profile_mappings
    SET display_name = ${displayName}
    WHERE domain_user_id = ${domainUserId}
  `;
}