import { boolean, integer, pgSchema, timestamp, varchar } from 'drizzle-orm/pg-core';
import { GoalsSchema } from './goals.schema';
import { UsersSchema } from './users.schema';

/** Epics are planning metadata, never executable tasks or sprint members. */
export const ScrumEpicsSchema = pgSchema('tasks').table('scrum_epics', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    goalId: integer('goal_id').notNull().references(() => GoalsSchema.id, { onDelete: 'cascade' }),
    title: varchar().notNull(),
    details: varchar(),
    archived: boolean().notNull().default(false),
    creatorId: integer('creator_id').references(() => UsersSchema.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    editedAt: timestamp('edited_at'),
    issueKey: varchar('issue_key', { length: 40 }).notNull().default(''),
});

export type ScrumEpicsSchemaTypeForSelect = typeof ScrumEpicsSchema.$inferSelect;
export type ScrumEpicsSchemaTypeForInsert = typeof ScrumEpicsSchema.$inferInsert;
