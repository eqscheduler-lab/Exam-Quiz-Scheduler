import { db } from "./db";
import {
  users, subjects, students, examEvents, settings, classes, loginAudit,
  type User, type InsertUser, type Subject, type InsertExamEvent, type ExamEvent, type Class, type LoginAudit, type InsertLoginAudit
} from "@shared/schema";
import { eq, and, count, gte, lte, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Classes
  getAllClasses(): Promise<Class[]>;
  createClass(classData: { name: string }): Promise<Class>;
  deleteClass(id: number): Promise<void>;

  // Subjects
  getAllSubjects(): Promise<Subject[]>;
  createSubject(subject: typeof subjects.$inferInsert): Promise<Subject>;
  updateSubject(id: number, subject: Partial<typeof subjects.$inferInsert>): Promise<Subject>;
  deleteSubject(id: number): Promise<void>;

  // Students
  getAllStudents(): Promise<typeof students.$inferSelect[]>;
  createStudent(student: typeof students.$inferInsert): Promise<typeof students.$inferSelect>;

  // Exams
  getExams(filters?: { 
    weekStart?: Date, 
    weekEnd?: Date, 
    classId?: number, 
    teacherId?: number 
  }): Promise<(ExamEvent & { subject: Subject, creator: User, class: Class })[]>;
  
  createExam(exam: InsertExamEvent): Promise<ExamEvent>;
  updateExam(id: number, exam: Partial<InsertExamEvent>): Promise<ExamEvent>;
  getExamCountForClassDay(date: Date, classId: number): Promise<number>;
  
  // Settings
  getSettings(): Promise<typeof settings.$inferSelect | undefined>;
  
  // Login Audit
  createLoginAudit(audit: InsertLoginAudit): Promise<LoginAudit>;
  getLoginAuditLogs(): Promise<(LoginAudit & { user: User })[]>;
  
  // Analytics
  getExamAnalytics(): Promise<{ classId: number; className: string; subjectId: number; subjectName: string; examCount: number; quizCount: number }[]>;
  
  // Factory Reset
  factoryReset(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllClasses(): Promise<Class[]> {
    return await db.select().from(classes);
  }

  async createClass(classData: { name: string }): Promise<Class> {
    const [newClass] = await db.insert(classes).values(classData).returning();
    return newClass;
  }

  async deleteClass(id: number): Promise<void> {
    await db.delete(classes).where(eq(classes.id, id));
  }

  async getAllSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects);
  }

  async createSubject(subject: typeof subjects.$inferInsert): Promise<Subject> {
    const [newSubject] = await db.insert(subjects).values(subject).returning();
    return newSubject;
  }

  async updateSubject(id: number, subject: Partial<typeof subjects.$inferInsert>): Promise<Subject> {
    const [updatedSubject] = await db.update(subjects).set(subject).where(eq(subjects.id, id)).returning();
    return updatedSubject;
  }

  async deleteSubject(id: number): Promise<void> {
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  async getAllStudents(): Promise<typeof students.$inferSelect[]> {
    return await db.select().from(students);
  }

  async createStudent(student: typeof students.$inferInsert): Promise<typeof students.$inferSelect> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async getExams(filters?: { 
    weekStart?: Date, 
    weekEnd?: Date, 
    classId?: number, 
    teacherId?: number 
  }): Promise<(ExamEvent & { subject: Subject, creator: User, class: Class })[]> {
    const conditions = [];
    
    // Only return SCHEDULED exams (not CANCELLED)
    conditions.push(eq(examEvents.status, "SCHEDULED"));
    
    if (filters?.weekStart && filters?.weekEnd) {
      conditions.push(and(gte(examEvents.date, filters.weekStart), lte(examEvents.date, filters.weekEnd)));
    }
    if (filters?.classId) {
      conditions.push(eq(examEvents.classId, filters.classId));
    }
    if (filters?.teacherId) {
      conditions.push(eq(examEvents.createdByUserId, filters.teacherId));
    }

    const results = await db.select({
      exam_events: examEvents,
      subjects: subjects,
      users: users,
      classes: classes
    })
    .from(examEvents)
    .innerJoin(subjects, eq(examEvents.subjectId, subjects.id))
    .innerJoin(users, eq(examEvents.createdByUserId, users.id))
    .innerJoin(classes, eq(examEvents.classId, classes.id))
    .where(and(...conditions))
    .orderBy(examEvents.date, examEvents.period);

    return results.map(r => ({
      ...r.exam_events,
      subject: r.subjects,
      creator: r.users,
      class: r.classes
    }));
  }

  async createExam(exam: InsertExamEvent): Promise<ExamEvent> {
    const [newExam] = await db.insert(examEvents).values(exam).returning();
    return newExam;
  }

  async updateExam(id: number, exam: Partial<InsertExamEvent>): Promise<ExamEvent> {
    const [updatedExam] = await db.update(examEvents).set(exam).where(eq(examEvents.id, id)).returning();
    return updatedExam;
  }

  async getExamCountForClassDay(date: Date, classId: number): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [result] = await db.select({ count: count() })
      .from(examEvents)
      .where(and(
        gte(examEvents.date, startOfDay),
        lte(examEvents.date, endOfDay),
        eq(examEvents.classId, classId),
        eq(examEvents.status, "SCHEDULED")
      ));
    
    return Number(result.count);
  }

  async getSettings(): Promise<typeof settings.$inferSelect | undefined> {
    const [setting] = await db.select().from(settings).limit(1);
    return setting;
  }

  async createLoginAudit(audit: InsertLoginAudit): Promise<LoginAudit> {
    const [newAudit] = await db.insert(loginAudit).values(audit).returning();
    return newAudit;
  }

  async getLoginAuditLogs(): Promise<(LoginAudit & { user: User })[]> {
    const results = await db.select({
      loginAudit: loginAudit,
      users: users
    })
    .from(loginAudit)
    .innerJoin(users, eq(loginAudit.userId, users.id))
    .orderBy(desc(loginAudit.loginAt))
    .limit(500);

    return results.map(r => ({
      ...r.loginAudit,
      user: r.users
    }));
  }

  async getExamAnalytics(): Promise<{ classId: number; className: string; subjectId: number; subjectName: string; examCount: number; quizCount: number }[]> {
    const allExams = await db.select({
      exam: examEvents,
      class: classes,
      subject: subjects
    })
    .from(examEvents)
    .innerJoin(classes, eq(examEvents.classId, classes.id))
    .innerJoin(subjects, eq(examEvents.subjectId, subjects.id))
    .where(eq(examEvents.status, "SCHEDULED"));

    // Aggregate by class and subject
    const statsMap = new Map<string, { classId: number; className: string; subjectId: number; subjectName: string; examCount: number; quizCount: number }>();
    
    for (const row of allExams) {
      const key = `${row.class.id}-${row.subject.id}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          classId: row.class.id,
          className: row.class.name,
          subjectId: row.subject.id,
          subjectName: row.subject.name,
          examCount: 0,
          quizCount: 0
        });
      }
      const stat = statsMap.get(key)!;
      if (row.exam.type === "HOMEWORK") {
        stat.examCount++;
      } else {
        stat.quizCount++;
      }
    }

    return Array.from(statsMap.values()).sort((a, b) => a.className.localeCompare(b.className));
  }

  async factoryReset(): Promise<void> {
    // Delete all data in order to respect foreign key constraints
    await db.delete(loginAudit);
    await db.delete(examEvents);
    await db.delete(subjects);
    await db.delete(classes);
    // Delete non-admin users only, keep admin accounts
    await db.delete(users).where(eq(users.role, "TEACHER"));
    await db.delete(users).where(eq(users.role, "COORDINATOR"));
    await db.delete(users).where(eq(users.role, "PRINCIPAL"));
    await db.delete(users).where(eq(users.role, "VICE_PRINCIPAL"));
  }
}

export const storage = new DatabaseStorage();
