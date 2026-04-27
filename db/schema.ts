import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';

export const menuItems = sqliteTable('menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: real('price').notNull(),
  image: text('image'),
});

export const menuSchedule = sqliteTable('menu_schedule', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
}, (t) => ({
  unq: unique().on(t.itemId, t.date),
}));

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentName: text('student_name').notNull(),
  studentClass: text('student_class').notNull(),
  studentMobile: text('student_mobile').notNull(),
  totalPrice: real('total_price').notNull(),
  status: text('status').notNull().default('pending'), // pending, preparing, ready, delivered
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  itemId: integer('item_id').notNull().references(() => menuItems.id),
  quantity: integer('quantity').notNull(),
  priceAtTime: real('price_at_time').notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type MenuSchedule = typeof menuSchedule.$inferSelect;
export type NewMenuSchedule = typeof menuSchedule.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
