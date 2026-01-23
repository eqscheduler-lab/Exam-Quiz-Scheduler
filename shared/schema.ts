import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoles = ["TEACHER", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"] as const;
export const classPrograms = ["AET", "AMT", "ENI", "CAI", "ASP"] as const;
export const examTypes = ["EXAM", "QUIZ"] as const;
export const examStatuses = ["SCHEDULED", "CANCELLED"] as const;

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("TEACHER"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  studentId: text("student_id").notNull().unique(),
  classProgram: text("class_program", { enum: classPrograms }).notNull(),
  section: integer("section").notNull(),
});

export const examEvents = pgTable("exam_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: examTypes }).notNull(),
  date: timestamp("date").notNull(),
  period: integer("period").notNull(),
  classProgram: text("class_program", { enum: classPrograms }).notNull(),
  section: integer("section").notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  status: text("status", { enum: examStatuses }).notNull().default("SCHEDULED"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  // JSON structure: { "Monday": ["08:00", "08:50", ...], ... }
  bellScheduleJson: jsonb("bell_schedule_json").$type<Record<string, string[]>>().notNull(),
  maxExamsPerDay: integer("max_exams_per_day").default(3).notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export const insertExamEventSchema = createInsertSchema(examEvents).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Subject = typeof subjects.$inferSelect;
export type Student = typeof students.$inferSelect;
export type ExamEvent = typeof examEvents.$inferSelect;
export type InsertExamEvent = z.infer<typeof insertExamEventSchema>;
export type Settings = typeof settings.$inferSelect;
