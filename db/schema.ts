import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const learnerState = sqliteTable('learner_state', {
  userId: text('user_id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
});
