import { integer, pgSchema, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { SprintsSchema } from './sprints.schema';
import { UsersSchema } from './users.schema';

export const SprintRetroActionsSchema = pgSchema('tasks').table('sprint_retro_actions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sprintId: integer('sprint_id').notNull().references(() => SprintsSchema.id, { onDelete: 'cascade' }),
    description: text().notNull(),
    owner: integer().references(() => UsersSchema.id, { onDelete: 'set null' }),
    status: varchar({ length: 20 }).$type<'planned' | 'in_progress' | 'done'>().notNull().default('planned'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
});

export type SprintRetroAction = typeof SprintRetroActionsSchema.$inferSelect;
