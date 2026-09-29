import { pgTable, uuid, varchar, timestamp, integer, smallint, text, jsonb, bigserial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  authProvider: varchar('auth_provider', { length: 50 }),
  authProviderId: varchar('auth_provider_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  nickname: varchar('nickname', { length: 30 }).notNull(),
  avatarId: varchar('avatar_id', { length: 50 }).default('default'),
  guestToken: varchar('guest_token', { length: 255 }).unique(),
  totalGamesPlayed: integer('total_games_played').default(0),
  totalWins: integer('total_wins').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const games = pgTable('games', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: jsonb('name').notNull(),
  description: jsonb('description').notNull(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  minPlayers: smallint('min_players').notNull(),
  maxPlayers: smallint('max_players').notNull(),
  avgDurationSeconds: integer('avg_duration_seconds'),
  categories: text('categories').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gameVersions = pgTable('game_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: varchar('game_id', { length: 50 }).references(() => games.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 20 }).notNull(),
  assetUrl: text('asset_url').notNull(),
  manifest: jsonb('manifest').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomCode: varchar('room_code', { length: 6 }).notNull(),
  hostProfileId: uuid('host_profile_id').references(() => profiles.id),
  status: varchar('status', { length: 20 }).notNull().default('lobby'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  gameId: varchar('game_id', { length: 50 }).references(() => games.id),
  gameVersion: varchar('game_version', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('playing'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
});

export const sessionPlayers = pgTable('session_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').references(() => profiles.id),
  seat: smallint('seat').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true }),
});

export const matchScores = pgTable('match_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').references(() => profiles.id),
  score: integer('score').notNull().default(0),
  rank: smallint('rank'),
  details: jsonb('details'),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  sessionId: uuid('session_id'),
  profileId: uuid('profile_id'),
  gameId: varchar('game_id', { length: 50 }),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
