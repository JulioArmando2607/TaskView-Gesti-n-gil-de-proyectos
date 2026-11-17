import { integer, numeric, pgSchema, varchar, boolean, date, time, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from 'drizzle-arktype';
import { UsersSchema } from "./users.schema";

export const TasksSchema = pgSchema('tasks').table('tasks', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    goalId: integer('goal_id').notNull(),
    parentId: integer('parent_id'),
    description: varchar(),
    complete: boolean(),
    goalListId: integer('goal_list_id'),
    creatorId: integer('creator_id'),
    note: varchar(),
    owner: integer().references(() => UsersSchema.id, { onDelete: 'cascade' }),
    priorityId: integer('priority_id').$type<1 | 2 | 3 | null>(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    startTime: time('start_time'),
    endTime: time('end_time'),
    statusId: integer('status_id'), //kanban column id
    taskOrder: integer('task_order'),
    kanbanOrder: integer('kanban_order'),
    amount: numeric({ precision: 10, scale: 2 }),
    transactionType: integer('transaction_type').$type<1 | 0 | null>(),
    nodeGraphPosition: jsonb('node_graph_position'),
    sourceUrl: varchar('source_url', { length: 500 }),
    sprintId: integer('sprint_id'),
    estimateValue: numeric('estimate_value', { precision: 10, scale: 2 }),
    dateComplete: timestamp('date_complete'),
    recurrenceRuleId: integer('recurrence_rule_id'),
    recurrenceInstanceDate: date('recurrence_instance_date'),
    /** Existing rows remain independent tasks; Scrum kinds are opt-in. */
    workItemType: varchar('work_item_type', { length: 16 }).$type<'task' | 'story' | 'bug'>().notNull().default('task'),
    epicId: integer('epic_id'),
    acceptanceCriteria: varchar('acceptance_criteria'),
    relatedTaskId: integer('related_task_id'),
    issueKey: varchar('issue_key', { length: 40 }).notNull().default(''),
});

export type TasksSchemaTypeForSelect = typeof TasksSchema.$inferSelect;

export type TasksSchemaTypeForInsert = typeof TasksSchema.$inferInsert;

export const TasksSchemaArkTypeInsert = createInsertSchema(TasksSchema);
