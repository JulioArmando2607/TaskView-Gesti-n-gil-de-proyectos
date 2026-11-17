import { integer, pgSchema, timestamp, varchar } from 'drizzle-orm/pg-core';
import { GoalsSchema } from './goals.schema';
import { TasksSchema } from './tasks.schema';
import { UsersSchema } from './users.schema';
import { SprintsSchema } from './sprints.schema';

export const QaReviewsSchema = pgSchema('tasks').table('qa_reviews', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    goalId: integer('goal_id').notNull().references(() => GoalsSchema.id, { onDelete: 'cascade' }),
    taskId: integer('task_id').notNull().references(() => TasksSchema.id, { onDelete: 'cascade' }),
    status: varchar({ length: 16 }).notNull().default('pending'),
    evidence: varchar(),
    validatedBy: integer('validated_by').references(() => UsersSchema.id, { onDelete: 'set null' }),
    validatedAt: timestamp('validated_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    editedAt: timestamp('edited_at'),
});

export const QaObservationsSchema = pgSchema('tasks').table('qa_observations', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    goalId: integer('goal_id').notNull(),
    taskId: integer('task_id').notNull(),
    reviewId: integer('review_id').notNull(),
    note: varchar().notNull(),
    bugTaskId: integer('bug_task_id'),
    createdBy: integer('created_by').references(() => UsersSchema.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const SprintReviewAcceptancesSchema = pgSchema('tasks').table('sprint_review_acceptances', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    goalId: integer('goal_id').notNull(),
    sprintId: integer('sprint_id').notNull().references(() => SprintsSchema.id, { onDelete: 'cascade' }),
    taskId: integer('task_id').notNull().references(() => TasksSchema.id, { onDelete: 'cascade' }),
    status: varchar({ length: 16 }).notNull(),
    notes: varchar(),
    reviewedBy: integer('reviewed_by').references(() => UsersSchema.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    editedAt: timestamp('edited_at'),
});

export type QaReview = typeof QaReviewsSchema.$inferSelect;
