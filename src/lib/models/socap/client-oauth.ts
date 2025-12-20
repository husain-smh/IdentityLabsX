/**
 * SOCAP Client OAuth Model
 * 
 * Stores OAuth tokens for clients who have authorized access to their X/Twitter account.
 * Tokens are stored per client (by email) and shared across all their campaigns.
 * 
 * This enables fetching "liking users" for the client's main tweets.
 * 
 * IMPORTANT: Only the tweet author can see who liked their tweets (X API privacy restriction).
 * This is why we only need OAuth for main tweets (authored by the client).
 */

import { Collection, ObjectId } from 'mongodb';
import { getClient } from '../../mongodb';
import crypto from 'crypto';

// ===== Encryption Configuration =====

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('OAUTH_ENCRYPTION_KEY environment variable is not set');
  }
  // Key should be 32 bytes (64 hex characters) for AES-256
  if (key.length !== 64) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a token using AES-256-GCM
 */
export function encryptToken(plainToken: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData (all in hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token using AES-256-GCM
 */
export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const parts = encryptedToken.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ===== TypeScript Interfaces =====

export interface ClientOAuth {
  _id?: string;
  
  // Client identification (links to campaigns via client_info.email)
  client_email: string;
  
  // X/Twitter user info (fetched from /users/me after auth)
  x_user_id: string;
  x_username: string;
  x_name: string;
  
  // OAuth tokens (ENCRYPTED)
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  
  // Token metadata
  token_expires_at: Date;
  scopes: string[];
  
  // Audit timestamps
  authorized_at: Date;
  last_refreshed_at: Date | null;
  last_used_at: Date | null;
  
  // Status
  status: 'active' | 'expired' | 'revoked';
  
  created_at: Date;
  updated_at: Date;
}

export interface ClientOAuthInput {
  client_email: string;
  x_user_id: string;
  x_username: string;
  x_name: string;
  access_token: string;  // Plain text - will be encrypted before storage
  refresh_token: string; // Plain text - will be encrypted before storage
  expires_in: number;    // Seconds until access token expires
  scopes: string[];
}

// ===== Collection Getter =====

export async function getClientOAuthCollection(): Promise<Collection<ClientOAuth>> {
  const client = await getClient();
  const db = client.db();
  return db.collection<ClientOAuth>('socap_client_oauth');
}

// ===== Indexes =====

export async function createClientOAuthIndexes(): Promise<void> {
  const collection = await getClientOAuthCollection();
  
  // Unique index on client_email - one OAuth per client
  await collection.createIndex(
    { client_email: 1 },
    { unique: true }
  );
  
  // Index for looking up by X user ID
  await collection.createIndex({ x_user_id: 1 });
  
  // Index for finding tokens that need refresh
  await collection.createIndex({ status: 1, token_expires_at: 1 });
}

// ===== CRUD Operations =====

/**
 * Create or update OAuth tokens for a client.
 * If client already has OAuth, updates the tokens (re-authorization).
 */
export async function upsertClientOAuth(input: ClientOAuthInput): Promise<ClientOAuth> {
  const collection = await getClientOAuthCollection();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expires_in * 1000);
  
  // Encrypt tokens before storage
  const accessTokenEncrypted = encryptToken(input.access_token);
  const refreshTokenEncrypted = encryptToken(input.refresh_token);
  
  const result = await collection.findOneAndUpdate(
    { client_email: input.client_email },
    {
      $set: {
        x_user_id: input.x_user_id,
        x_username: input.x_username,
        x_name: input.x_name,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: expiresAt,
        scopes: input.scopes,
        status: 'active' as const,
        last_refreshed_at: now,
        updated_at: now,
      },
      $setOnInsert: {
        client_email: input.client_email,
        authorized_at: now,
        last_used_at: null,
        created_at: now,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );
  
  return result as ClientOAuth;
}

/**
 * Get OAuth tokens for a client by email.
 */
export async function getClientOAuthByEmail(clientEmail: string): Promise<ClientOAuth | null> {
  const collection = await getClientOAuthCollection();
  return await collection.findOne({ client_email: clientEmail });
}

/**
 * Get OAuth tokens for a client by X user ID.
 */
export async function getClientOAuthByXUserId(xUserId: string): Promise<ClientOAuth | null> {
  const collection = await getClientOAuthCollection();
  return await collection.findOne({ x_user_id: xUserId });
}

/**
 * Update tokens after a refresh.
 */
export async function updateClientOAuthTokens(
  clientEmail: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<boolean> {
  const collection = await getClientOAuthCollection();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresIn * 1000);
  
  const result = await collection.updateOne(
    { client_email: clientEmail },
    {
      $set: {
        access_token_encrypted: encryptToken(accessToken),
        refresh_token_encrypted: encryptToken(refreshToken),
        token_expires_at: expiresAt,
        last_refreshed_at: now,
        status: 'active' as const,
        updated_at: now,
      },
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Update the last_used_at timestamp.
 */
export async function updateClientOAuthLastUsed(clientEmail: string): Promise<void> {
  const collection = await getClientOAuthCollection();
  
  await collection.updateOne(
    { client_email: clientEmail },
    {
      $set: {
        last_used_at: new Date(),
        updated_at: new Date(),
      },
    }
  );
}

/**
 * Update OAuth status (e.g., mark as expired or revoked).
 */
export async function updateClientOAuthStatus(
  clientEmail: string,
  status: ClientOAuth['status']
): Promise<boolean> {
  const collection = await getClientOAuthCollection();
  
  const result = await collection.updateOne(
    { client_email: clientEmail },
    {
      $set: {
        status,
        updated_at: new Date(),
      },
    }
  );
  
  return result.modifiedCount > 0;
}

/**
 * Delete OAuth tokens for a client (revoke access).
 */
export async function deleteClientOAuth(clientEmail: string): Promise<boolean> {
  const collection = await getClientOAuthCollection();
  
  const result = await collection.deleteOne({ client_email: clientEmail });
  return result.deletedCount > 0;
}

/**
 * Get decrypted access token for a client.
 * Returns null if no OAuth or status is not active.
 */
export async function getDecryptedAccessToken(clientEmail: string): Promise<string | null> {
  const oauth = await getClientOAuthByEmail(clientEmail);
  
  if (!oauth || oauth.status !== 'active') {
    return null;
  }
  
  try {
    return decryptToken(oauth.access_token_encrypted);
  } catch (error) {
    console.error(`Failed to decrypt access token for ${clientEmail}:`, error);
    return null;
  }
}

/**
 * Get decrypted refresh token for a client.
 */
export async function getDecryptedRefreshToken(clientEmail: string): Promise<string | null> {
  const oauth = await getClientOAuthByEmail(clientEmail);
  
  if (!oauth) {
    return null;
  }
  
  try {
    return decryptToken(oauth.refresh_token_encrypted);
  } catch (error) {
    console.error(`Failed to decrypt refresh token for ${clientEmail}:`, error);
    return null;
  }
}

/**
 * Check if a client has valid (non-expired) OAuth.
 */
export async function hasValidOAuth(clientEmail: string): Promise<boolean> {
  const oauth = await getClientOAuthByEmail(clientEmail);
  
  if (!oauth || oauth.status !== 'active') {
    return false;
  }
  
  // Check if token is expired (with 5 min buffer)
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  const expiresAt = oauth.token_expires_at.getTime();
  
  // Even if access token is expired, we can refresh using refresh token
  // So we return true as long as status is active
  return true;
}

/**
 * Get all clients with OAuth that needs token refresh.
 * Returns clients whose access tokens expire within the next hour.
 */
export async function getClientsNeedingTokenRefresh(): Promise<ClientOAuth[]> {
  const collection = await getClientOAuthCollection();
  
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  
  return await collection.find({
    status: 'active',
    token_expires_at: { $lte: oneHourFromNow },
  }).toArray();
}
