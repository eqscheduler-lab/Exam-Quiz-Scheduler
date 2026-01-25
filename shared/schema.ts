import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoles = ["TEACHER", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"] as const;
export const classPrograms = ["AET", "AMT", "ENI", "CAI", "ASP"] as const;
export const examTypes = ["EXAM", "QUIZ"] as const;
export const examStatuses = ["SCHEDULED", "CANCELLED"] as const;

// Bell Schedules Constants
export const BELL_SCHEDULES = {
  G9_10: {
    MON_THU: {
      1: "07:30–08:20",
      2: "08:25–09:15",
      break1: "09:15–09:30 (Break)",
      3: "09:30–10:20",
      4: "10:25–11:15",
      5: "11:20–12:10",
      break2: "12:10–12:40 (Break)",
      6: "12:40–13:30",
      7: "13:35–14:25",
      8: "14:30–15:10",
    },
    FRI: {
      1: "07:30–08:20",
      2: "08:25–09:15",
      break1: "09:15–09:25 (Break)",
      3: "09:25–10:15",
      4: "10:20–11:10",
    }
  },
  G11_12: {
    MON_THU: {
      1: "07:30–08:20",
      2: "08:25–09:15",
      3: "09:20–10:10",
      break1: "10:10–10:25 (Break)",
      4: "10:25–11:15",
      5: "11:20–12:10",
      6: "12:15–13:05",
      break2: "13:05–13:35 (Break)",
      7: "13:35–14:25",
      8: "14:30–15:10",
    },
    FRI: {
      1: "07:30–08:20",
      2: "08:25–09:15",
      3: "09:20–10:10",
      break1: "10:10–10:20 (Break)",
      4: "10:20–11:10",
    }
  }
} as const;

export const getGradeLevel = (className: string): "G9_10" | "G11_12" => {
  const match = className.match(/A(10|11|12|9)/);
  if (match) {
    const grade = parseInt(match[1]);
    return grade <= 10 ? "G9_10" : "G11_12";
  }
  return "G9_10";
};

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

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g. "A10 [AMT]/1"
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
  classId: integer("class_id").references(() => classes.id).notNull(),
});

export const examEvents = pgTable("exam_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: examTypes }).notNull(),
  date: timestamp("date").notNull(),
  period: integer("period").notNull(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  status: text("status", { enum: examStatuses }).notNull().default("SCHEDULED"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  bellScheduleJson: jsonb("bell_schedule_json").$type<Record<string, string[]>>().notNull(),
  maxExamsPerDay: integer("max_exams_per_day").default(3).notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export const insertExamEventSchema = createInsertSchema(examEvents).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Subject = typeof subjects.$inferSelect;
export type Student = typeof students.$inferSelect;
export type ExamEvent = typeof examEvents.$inferSelect;
export type InsertExamEvent = z.infer<typeof insertExamEventSchema>;
export type Settings = typeof settings.$inferSelect;
