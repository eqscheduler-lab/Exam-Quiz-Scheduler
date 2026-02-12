import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoles = ["TEACHER", "ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "LEAD_TEACHER"] as const;
export const defaultDepartments = ["SCIENCE", "MATHEMATICS", "ENGLISH", "ARABIC", "SOCIAL_STUDIES", "PHYSICAL_EDUCATION", "ARTS", "TECHNOLOGY", "ISLAMIC_STUDIES", "FRENCH"] as const;
// Keep 'departments' for backward compatibility - will be deprecated in favor of database table
export const departments = defaultDepartments;
export const classPrograms = ["AET", "AMT", "ENI", "CAI", "ASP"] as const;
export const examTypes = ["HOMEWORK", "QUIZ"] as const;
export const examStatuses = ["SCHEDULED", "CANCELLED"] as const;
export const approvalStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export const academicTerms = ["TERM_1", "TERM_2", "TERM_3"] as const;

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
  department: text("department"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

// Departments table for dynamic department management
export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  maxExamsPerDay: integer("max_exams_per_day").default(2).notNull(),
});

export const loginAudit = pgTable("login_audit", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  username: text("username").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  loginAt: timestamp("login_at").defaultNow().notNull(),
  success: boolean("success").default(true).notNull(),
});

export const learningSummaries = pgTable("learning_summaries", {
  id: serial("id").primaryKey(),
  term: text("term", { enum: academicTerms }).notNull(),
  weekNumber: integer("week_number").notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  grade: text("grade").notNull(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  teacherId: integer("teacher_id").references(() => users.id).notNull(),
  upcomingTopics: text("upcoming_topics"),
  quizDay: text("quiz_day"),
  quizDate: timestamp("quiz_date"),
  quizTime: text("quiz_time"),
  status: text("status", { enum: approvalStatuses }).notNull().default("DRAFT"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvalComments: text("approval_comments"),
  linkedExamId: integer("linked_exam_id").references(() => examEvents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const learningSupport = pgTable("learning_support", {
  id: serial("id").primaryKey(),
  term: text("term", { enum: academicTerms }).notNull(),
  weekNumber: integer("week_number").notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  grade: text("grade").notNull(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  teacherId: integer("teacher_id").references(() => users.id).notNull(),
  sessionType: text("session_type"),
  teamsLink: text("teams_link"),
  location: text("location"),
  sapetDay: text("sapet_day"),
  sapetDate: timestamp("sapet_date"),
  sapetTime: text("sapet_time"),
  status: text("status", { enum: approvalStatuses }).notNull().default("DRAFT"),
  approvedById: integer("approved_by_id").references(() => users.id),
  approvalComments: text("approval_comments"),
  linkedExamId: integer("linked_exam_id").references(() => examEvents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Certificate System
export const certificateStatuses = ["ISSUED", "REVOKED", "EXPIRED"] as const;

export const certificateTemplates = pgTable("certificate_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  htmlTemplate: text("html_template").notNull(),
  cssTemplate: text("css_template").notNull().default(""),
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  publicId: text("public_id").notNull().unique(),
  templateId: integer("template_id").references(() => certificateTemplates.id).notNull(),
  recipientUserId: integer("recipient_user_id").references(() => users.id).notNull(),
  issuedByUserId: integer("issued_by_user_id").references(() => users.id).notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientRole: text("recipient_role").notNull(),
  recipientDepartment: text("recipient_department"),
  title: text("title").notNull(),
  status: text("status", { enum: certificateStatuses }).notNull().default("ISSUED"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  expiresAt: timestamp("expires_at"),
  payload: jsonb("payload").$type<Record<string, string>>(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true });
export const insertExamEventSchema = createInsertSchema(examEvents).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export const insertLoginAuditSchema = createInsertSchema(loginAudit).omit({ id: true, loginAt: true });
export const insertLearningSummarySchema = createInsertSchema(learningSummaries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLearningSupportSchema = createInsertSchema(learningSupport).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateTemplateSchema = createInsertSchema(certificateTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, issuedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

// Department types
export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true });
export type Department = typeof departmentsTable.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Subject = typeof subjects.$inferSelect;
export type Student = typeof students.$inferSelect;
export type ExamEvent = typeof examEvents.$inferSelect;
export type InsertExamEvent = z.infer<typeof insertExamEventSchema>;
export type Settings = typeof settings.$inferSelect;
export type LoginAudit = typeof loginAudit.$inferSelect;
export type InsertLoginAudit = z.infer<typeof insertLoginAuditSchema>;
export type LearningSummary = typeof learningSummaries.$inferSelect;
export type InsertLearningSummary = z.infer<typeof insertLearningSummarySchema>;
export type LearningSupport = typeof learningSupport.$inferSelect;
export type InsertLearningSupport = z.infer<typeof insertLearningSupportSchema>;

// SAPET Session Attendance
export const attendanceStatuses = ["PRESENT", "ABSENT"] as const;

export const sapetAttendance = pgTable("sapet_attendance", {
  id: serial("id").primaryKey(),
  learningSupportId: integer("learning_support_id").references(() => learningSupport.id).notNull(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  status: text("status", { enum: attendanceStatuses }).notNull().default("ABSENT"),
  markedAt: timestamp("marked_at").defaultNow(),
  markedById: integer("marked_by_id").references(() => users.id),
});

export const insertSapetAttendanceSchema = createInsertSchema(sapetAttendance).omit({ id: true, markedAt: true });
export type SapetAttendance = typeof sapetAttendance.$inferSelect;
export type InsertSapetAttendance = z.infer<typeof insertSapetAttendanceSchema>;

export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type InsertCertificateTemplate = z.infer<typeof insertCertificateTemplateSchema>;
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
