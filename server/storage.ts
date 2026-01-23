import { db } from "./db";
import {
  users, subjects, students, examEvents, settings,
  type User, type InsertUser, type Subject, type InsertExamEvent, type ExamEvent
} from "@shared/schema";
import { eq, and, count, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Subjects
  getAllSubjects(): Promise<Subject[]>;
  createSubject(subject: typeof subjects.$inferInsert): Promise<Subject>;

  // Students
  getAllStudents(): Promise<typeof students.$inferSelect[]>;
  createStudent(student: typeof students.$inferInsert): Promise<typeof students.$inferSelect>;

  // Exams
  getExams(filters?: { 
    weekStart?: Date, 
    weekEnd?: Date, 
    classProgram?: string, 
    section?: number,
    teacherId?: number 
  }): Promise<(ExamEvent & { subject: Subject, creator: User })[]>;
  
  createExam(exam: InsertExamEvent): Promise<ExamEvent>;
  updateExam(id: number, exam: Partial<InsertExamEvent>): Promise<ExamEvent>;
  getExamCountForClassDay(date: Date, classProgram: string, section: number): Promise<number>;
  
  // Settings
  getSettings(): Promise<typeof settings.$inferSelect | undefined>;
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

  async getAllSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects);
  }

  async createSubject(subject: typeof subjects.$inferInsert): Promise<Subject> {
    const [newSubject] = await db.insert(subjects).values(subject).returning();
    return newSubject;
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
    classProgram?: string, 
    section?: number,
    teacherId?: number 
  }): Promise<(ExamEvent & { subject: Subject, creator: User })[]> {
    const conditions = [];
    if (filters?.weekStart && filters?.weekEnd) {
      conditions.push(and(gte(examEvents.date, filters.weekStart), lte(examEvents.date, filters.weekEnd)));
    }
    if (filters?.classProgram) {
      conditions.push(eq(examEvents.classProgram, filters.classProgram));
    }
    if (filters?.section) {
      conditions.push(eq(examEvents.section, filters.section));
    }
    if (filters?.teacherId) {
      conditions.push(eq(examEvents.createdByUserId, filters.teacherId));
    }

    return await db.select({
      ...examEvents._.columns,
      subject: subjects,
      creator: users
    })
    .from(examEvents)
    .innerJoin(subjects, eq(examEvents.subjectId, subjects.id))
    .innerJoin(users, eq(examEvents.createdByUserId, users.id))
    .where(and(...conditions))
    .orderBy(examEvents.date, examEvents.period);
  }

  async createExam(exam: InsertExamEvent): Promise<ExamEvent> {
    const [newExam] = await db.insert(examEvents).values(exam).returning();
    return newExam;
  }

  async updateExam(id: number, exam: Partial<InsertExamEvent>): Promise<ExamEvent> {
    const [updatedExam] = await db.update(examEvents).set(exam).where(eq(examEvents.id, id)).returning();
    return updatedExam;
  }

  async getExamCountForClassDay(date: Date, classProgram: string, section: number): Promise<number> {
    // Count exams for this class + section on this specific date
    // Note: 'date' in DB is timestamp, we should compare by day.
    // For simplicity assuming the date passed is start of day or we use a range.
    // Ideally we cast to date.
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [result] = await db.select({ count: count() })
      .from(examEvents)
      .where(and(
        gte(examEvents.date, startOfDay),
        lte(examEvents.date, endOfDay),
        eq(examEvents.classProgram, classProgram),
        eq(examEvents.section, section),
        eq(examEvents.status, "SCHEDULED")
      ));
    
    return result.count;
  }

  async getSettings(): Promise<typeof settings.$inferSelect | undefined> {
    const [setting] = await db.select().from(settings).limit(1);
    return setting;
  }
}

export const storage = new DatabaseStorage();
