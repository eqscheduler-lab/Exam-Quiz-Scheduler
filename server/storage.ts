import { db } from "./db";
import {
  users, subjects, students, examEvents, settings, classes, loginAudit, learningSummaries, learningSupport, sapetAttendance, departmentsTable,
  certificateTemplates, certificates,
  type User, type InsertUser, type Subject, type InsertExamEvent, type ExamEvent, type Class, type LoginAudit, type InsertLoginAudit,
  type LearningSummary, type InsertLearningSummary, type LearningSupport, type InsertLearningSupport, type SapetAttendance, type InsertSapetAttendance,
  type Department, type InsertDepartment,
  type CertificateTemplate, type InsertCertificateTemplate, type Certificate, type InsertCertificate
} from "@shared/schema";
import { eq, and, count, gte, lte, desc, sql } from "drizzle-orm";

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
  updateClass(id: number, classData: { name: string }): Promise<Class>;
  deleteClass(id: number): Promise<void>;

  // Subjects
  getAllSubjects(): Promise<Subject[]>;
  createSubject(subject: typeof subjects.$inferInsert): Promise<Subject>;
  updateSubject(id: number, subject: Partial<typeof subjects.$inferInsert>): Promise<Subject>;
  deleteSubject(id: number): Promise<void>;

  // Students
  getAllStudents(classId?: number): Promise<typeof students.$inferSelect[]>;
  createStudent(student: typeof students.$inferInsert): Promise<typeof students.$inferSelect>;
  updateStudent(id: number, student: Partial<typeof students.$inferInsert>): Promise<typeof students.$inferSelect>;
  deleteStudent(id: number): Promise<void>;

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
  getQuizCountForClassDay(date: Date, classId: number): Promise<number>;
  getExistingBooking(date: Date, period: number, classId: number): Promise<ExamEvent | null>;
  
  // Settings
  getSettings(): Promise<typeof settings.$inferSelect | undefined>;
  
  // Login Audit
  createLoginAudit(audit: InsertLoginAudit): Promise<LoginAudit>;
  getLoginAuditLogs(): Promise<(LoginAudit & { user: User })[]>;
  
  // Analytics
  getExamAnalytics(): Promise<{ classId: number; className: string; subjectId: number; subjectName: string; subjectCode: string; examCount: number; quizCount: number }[]>;
  getTeacherAnalytics(): Promise<{ teacherId: number; teacherName: string; classId: number; className: string; homeworkCount: number; quizCount: number }[]>;
  getWeeklyStaffUtilization(): Promise<{ 
    teacherId: number; 
    teacherName: string; 
    weekStart: string; 
    homeworkCount: number; 
    quizCount: number; 
    totalEntries: number;
  }[]>;
  
  // Factory Reset
  factoryReset(): Promise<void>;
  
  // Account Activity Tracking
  updateLastAccessedAt(userId: number): Promise<void>;
  getInactiveAccounts(): Promise<User[]>;
  markAccountInactive(userId: number): Promise<User>;

  // Learning Summaries
  getLearningSummaries(filters?: { term?: string; weekNumber?: number }): Promise<(LearningSummary & { class: Class; subject: Subject; teacher: User })[]>;
  createLearningSummary(summary: InsertLearningSummary): Promise<LearningSummary>;
  updateLearningSummary(id: number, summary: Partial<InsertLearningSummary>): Promise<LearningSummary>;
  deleteLearningSummary(id: number): Promise<void>;
  getLearningSummaryById(id: number): Promise<(LearningSummary & { class: Class; subject: Subject; teacher: User }) | undefined>;

  // Learning Support (SAPET)
  getLearningSupport(filters?: { term?: string; weekNumber?: number }): Promise<(LearningSupport & { class: Class; subject: Subject; teacher: User })[]>;
  createLearningSupport(support: InsertLearningSupport): Promise<LearningSupport>;
  updateLearningSupport(id: number, support: Partial<InsertLearningSupport>): Promise<LearningSupport>;
  deleteLearningSupport(id: number): Promise<void>;
  getLearningSupportById(id: number): Promise<(LearningSupport & { class: Class; subject: Subject; teacher: User }) | undefined>;

  // SAPET Attendance
  getSapetAttendance(learningSupportId: number): Promise<(SapetAttendance & { student: typeof students.$inferSelect })[]>;
  getStudentsByClass(classId: number): Promise<typeof students.$inferSelect[]>;
  saveSapetAttendance(learningSupportId: number, attendanceData: { studentId: number; status: "PRESENT" | "ABSENT" }[], markedById: number): Promise<SapetAttendance[]>;
  getAllAttendance(): Promise<SapetAttendance[]>;
  
  // Departments
  getAllDepartments(): Promise<Department[]>;
  getDepartmentById(id: number): Promise<Department | undefined>;
  createDepartment(dept: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, dept: Partial<InsertDepartment>): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;

  // Certificate Templates
  getAllCertificateTemplates(): Promise<CertificateTemplate[]>;
  getCertificateTemplateById(id: number): Promise<CertificateTemplate | undefined>;
  createCertificateTemplate(template: InsertCertificateTemplate): Promise<CertificateTemplate>;
  updateCertificateTemplate(id: number, template: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate>;
  deleteCertificateTemplate(id: number): Promise<void>;

  // Certificates
  getAllCertificates(): Promise<(Certificate & { template: CertificateTemplate; recipient: User; issuer: User })[]>;
  getCertificateByPublicId(publicId: string): Promise<(Certificate & { template: CertificateTemplate; recipient: User; issuer: User }) | undefined>;
  getCertificateById(id: number): Promise<Certificate | undefined>;
  createCertificate(cert: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: number, cert: Partial<InsertCertificate>): Promise<Certificate>;
  getCertificatesByRecipient(userId: number): Promise<(Certificate & { template: CertificateTemplate })[]>;
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

  async updateClass(id: number, classData: { name: string }): Promise<Class> {
    const [updatedClass] = await db.update(classes).set(classData).where(eq(classes.id, id)).returning();
    return updatedClass;
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

  async getAllStudents(classId?: number): Promise<typeof students.$inferSelect[]> {
    if (classId) {
      return await db.select().from(students).where(eq(students.classId, classId));
    }
    return await db.select().from(students);
  }

  async createStudent(student: typeof students.$inferInsert): Promise<typeof students.$inferSelect> {
    const [newStudent] = await db.insert(students).values(student).returning();
    return newStudent;
  }

  async updateStudent(id: number, student: Partial<typeof students.$inferInsert>): Promise<typeof students.$inferSelect> {
    const [updatedStudent] = await db.update(students).set(student).where(eq(students.id, id)).returning();
    return updatedStudent;
  }

  async deleteStudent(id: number): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
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
    // Use SQL DATE cast for timezone-safe comparison
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD

    const [result] = await db.select({ count: count() })
      .from(examEvents)
      .where(and(
        sql`DATE(${examEvents.date}) = ${dateStr}`,
        eq(examEvents.classId, classId),
        eq(examEvents.status, "SCHEDULED")
      ));
    
    return Number(result.count);
  }

  async getQuizCountForClassDay(date: Date, classId: number): Promise<number> {
    // Use SQL DATE cast for timezone-safe comparison
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD

    const [result] = await db.select({ count: count() })
      .from(examEvents)
      .where(and(
        sql`DATE(${examEvents.date}) = ${dateStr}`,
        eq(examEvents.classId, classId),
        eq(examEvents.status, "SCHEDULED"),
        eq(examEvents.type, "QUIZ")
      ));
    
    return Number(result.count);
  }

  async getExistingBooking(date: Date, period: number, classId: number): Promise<ExamEvent | null> {
    // Use SQL DATE cast for timezone-safe comparison
    const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD

    const [existing] = await db.select()
      .from(examEvents)
      .where(and(
        sql`DATE(${examEvents.date}) = ${dateStr}`,
        eq(examEvents.period, period),
        eq(examEvents.classId, classId),
        eq(examEvents.status, "SCHEDULED")
      ))
      .limit(1);
    
    return existing || null;
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

  async getExamAnalytics(): Promise<{ classId: number; className: string; subjectId: number; subjectName: string; subjectCode: string; examCount: number; quizCount: number }[]> {
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
    const statsMap = new Map<string, { classId: number; className: string; subjectId: number; subjectName: string; subjectCode: string; examCount: number; quizCount: number }>();
    
    for (const row of allExams) {
      const key = `${row.class.id}-${row.subject.id}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          classId: row.class.id,
          className: row.class.name,
          subjectId: row.subject.id,
          subjectName: row.subject.name,
          subjectCode: row.subject.code,
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

  async getTeacherAnalytics(): Promise<{ 
    teacherId: number; 
    teacherName: string; 
    classId: number; 
    className: string; 
    homeworkCount: number; 
    quizCount: number 
  }[]> {
    const allExams = await db.select({
      exam: examEvents,
      class: classes,
      user: users
    })
    .from(examEvents)
    .innerJoin(classes, eq(examEvents.classId, classes.id))
    .innerJoin(users, eq(examEvents.createdByUserId, users.id))
    .where(eq(examEvents.status, "SCHEDULED"));

    // Aggregate by teacher and class
    const statsMap = new Map<string, { 
      teacherId: number; 
      teacherName: string; 
      classId: number; 
      className: string; 
      homeworkCount: number; 
      quizCount: number 
    }>();
    
    for (const row of allExams) {
      const key = `${row.user.id}-${row.class.id}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          teacherId: row.user.id,
          teacherName: row.user.name,
          classId: row.class.id,
          className: row.class.name,
          homeworkCount: 0,
          quizCount: 0
        });
      }
      const stat = statsMap.get(key)!;
      if (row.exam.type === "HOMEWORK") {
        stat.homeworkCount++;
      } else {
        stat.quizCount++;
      }
    }

    return Array.from(statsMap.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }

  async getWeeklyStaffUtilization(): Promise<{ 
    teacherId: number; 
    teacherName: string; 
    weekStart: string; 
    homeworkCount: number; 
    quizCount: number; 
    totalEntries: number;
  }[]> {
    const allExams = await db.select({
      exam: examEvents,
      user: users
    })
    .from(examEvents)
    .innerJoin(users, eq(examEvents.createdByUserId, users.id))
    .where(eq(examEvents.status, "SCHEDULED"));

    // Group by teacher and week
    const statsMap = new Map<string, { 
      teacherId: number; 
      teacherName: string; 
      weekStart: string; 
      homeworkCount: number; 
      quizCount: number; 
      totalEntries: number;
    }>();
    
    for (const row of allExams) {
      // Calculate week start (Monday)
      const examDate = new Date(row.exam.date);
      const dayOfWeek = examDate.getDay();
      const diff = examDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(examDate.setDate(diff));
      const weekStartStr = weekStart.toISOString().split('T')[0];
      
      const key = `${row.user.id}-${weekStartStr}`;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          teacherId: row.user.id,
          teacherName: row.user.name,
          weekStart: weekStartStr,
          homeworkCount: 0,
          quizCount: 0,
          totalEntries: 0
        });
      }
      const stat = statsMap.get(key)!;
      if (row.exam.type === "HOMEWORK") {
        stat.homeworkCount++;
      } else {
        stat.quizCount++;
      }
      stat.totalEntries++;
    }

    return Array.from(statsMap.values()).sort((a, b) => {
      // Sort by week descending, then by teacher name
      if (a.weekStart !== b.weekStart) {
        return b.weekStart.localeCompare(a.weekStart);
      }
      return a.teacherName.localeCompare(b.teacherName);
    });
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
  
  async updateLastAccessedAt(userId: number): Promise<void> {
    await db.update(users).set({ lastAccessedAt: new Date() }).where(eq(users.id, userId));
  }
  
  async getInactiveAccounts(): Promise<User[]> {
    // Get all users where lastAccessedAt is null (never logged in)
    const allUsers = await db.select().from(users);
    
    return allUsers.filter(user => {
      // Skip admin accounts for inactivity tracking
      if (user.role === "ADMIN") return false;
      
      // Show all accounts that have never accessed the app
      if (!user.lastAccessedAt) {
        return true;
      }
      return false;
    });
  }
  
  async markAccountInactive(userId: number): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  // Learning Summaries
  async getLearningSummaries(filters?: { term?: string; weekNumber?: number }): Promise<(LearningSummary & { class: Class; subject: Subject; teacher: User })[]> {
    const conditions = [];
    
    if (filters?.term) {
      conditions.push(eq(learningSummaries.term, filters.term as "TERM_1" | "TERM_2" | "TERM_3"));
    }
    if (filters?.weekNumber) {
      conditions.push(eq(learningSummaries.weekNumber, filters.weekNumber));
    }

    const results = await db.select({
      summary: learningSummaries,
      class: classes,
      subject: subjects,
      teacher: users
    })
    .from(learningSummaries)
    .innerJoin(classes, eq(learningSummaries.classId, classes.id))
    .innerJoin(subjects, eq(learningSummaries.subjectId, subjects.id))
    .innerJoin(users, eq(learningSummaries.teacherId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(learningSummaries.grade, classes.name);

    return results.map(r => ({
      ...r.summary,
      class: r.class,
      subject: r.subject,
      teacher: r.teacher
    }));
  }

  async createLearningSummary(summary: InsertLearningSummary): Promise<LearningSummary> {
    const [newSummary] = await db.insert(learningSummaries).values(summary).returning();
    return newSummary;
  }

  async updateLearningSummary(id: number, summary: Partial<InsertLearningSummary>): Promise<LearningSummary> {
    const [updatedSummary] = await db.update(learningSummaries)
      .set({ ...summary, updatedAt: new Date() })
      .where(eq(learningSummaries.id, id))
      .returning();
    return updatedSummary;
  }

  async deleteLearningSummary(id: number): Promise<void> {
    const [summary] = await db.select().from(learningSummaries).where(eq(learningSummaries.id, id)).limit(1);
    if (summary?.linkedExamId) {
      await db.delete(examEvents).where(eq(examEvents.id, summary.linkedExamId));
    }
    await db.delete(learningSummaries).where(eq(learningSummaries.id, id));
  }

  async getLearningSummaryById(id: number): Promise<(LearningSummary & { class: Class; subject: Subject; teacher: User }) | undefined> {
    const results = await db.select({
      summary: learningSummaries,
      class: classes,
      subject: subjects,
      teacher: users
    })
    .from(learningSummaries)
    .innerJoin(classes, eq(learningSummaries.classId, classes.id))
    .innerJoin(subjects, eq(learningSummaries.subjectId, subjects.id))
    .innerJoin(users, eq(learningSummaries.teacherId, users.id))
    .where(eq(learningSummaries.id, id))
    .limit(1);

    if (results.length === 0) return undefined;
    
    return {
      ...results[0].summary,
      class: results[0].class,
      subject: results[0].subject,
      teacher: results[0].teacher
    };
  }

  // Learning Support (SAPET)
  async getLearningSupport(filters?: { term?: string; weekNumber?: number }): Promise<(LearningSupport & { class: Class; subject: Subject; teacher: User })[]> {
    const conditions = [];
    
    if (filters?.term) {
      conditions.push(eq(learningSupport.term, filters.term as "TERM_1" | "TERM_2" | "TERM_3"));
    }
    if (filters?.weekNumber) {
      conditions.push(eq(learningSupport.weekNumber, filters.weekNumber));
    }

    const results = await db.select({
      support: learningSupport,
      class: classes,
      subject: subjects,
      teacher: users
    })
    .from(learningSupport)
    .innerJoin(classes, eq(learningSupport.classId, classes.id))
    .innerJoin(subjects, eq(learningSupport.subjectId, subjects.id))
    .innerJoin(users, eq(learningSupport.teacherId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(learningSupport.grade, classes.name);

    return results.map(r => ({
      ...r.support,
      class: r.class,
      subject: r.subject,
      teacher: r.teacher
    }));
  }

  async createLearningSupport(support: InsertLearningSupport): Promise<LearningSupport> {
    const [newSupport] = await db.insert(learningSupport).values(support).returning();
    return newSupport;
  }

  async updateLearningSupport(id: number, support: Partial<InsertLearningSupport>): Promise<LearningSupport> {
    const [updatedSupport] = await db.update(learningSupport)
      .set({ ...support, updatedAt: new Date() })
      .where(eq(learningSupport.id, id))
      .returning();
    return updatedSupport;
  }

  async deleteLearningSupport(id: number): Promise<void> {
    await db.delete(sapetAttendance).where(eq(sapetAttendance.learningSupportId, id));
    await db.delete(learningSupport).where(eq(learningSupport.id, id));
  }

  async getLearningSupportById(id: number): Promise<(LearningSupport & { class: Class; subject: Subject; teacher: User }) | undefined> {
    const results = await db.select({
      support: learningSupport,
      class: classes,
      subject: subjects,
      teacher: users
    })
    .from(learningSupport)
    .innerJoin(classes, eq(learningSupport.classId, classes.id))
    .innerJoin(subjects, eq(learningSupport.subjectId, subjects.id))
    .innerJoin(users, eq(learningSupport.teacherId, users.id))
    .where(eq(learningSupport.id, id))
    .limit(1);

    if (results.length === 0) return undefined;
    
    return {
      ...results[0].support,
      class: results[0].class,
      subject: results[0].subject,
      teacher: results[0].teacher
    };
  }

  // SAPET Attendance
  async getSapetAttendance(learningSupportId: number): Promise<(SapetAttendance & { student: typeof students.$inferSelect })[]> {
    const results = await db.select({
      attendance: sapetAttendance,
      student: students
    })
    .from(sapetAttendance)
    .innerJoin(students, eq(sapetAttendance.studentId, students.id))
    .where(eq(sapetAttendance.learningSupportId, learningSupportId));

    return results.map(r => ({
      ...r.attendance,
      student: r.student
    }));
  }

  async getStudentsByClass(classId: number): Promise<typeof students.$inferSelect[]> {
    return await db.select().from(students).where(eq(students.classId, classId));
  }

  async saveSapetAttendance(
    learningSupportId: number, 
    attendanceData: { studentId: number; status: "PRESENT" | "ABSENT" }[], 
    markedById: number
  ): Promise<SapetAttendance[]> {
    // Delete existing attendance for this session
    await db.delete(sapetAttendance).where(eq(sapetAttendance.learningSupportId, learningSupportId));
    
    // Insert new attendance records
    if (attendanceData.length === 0) return [];
    
    const records = attendanceData.map(a => ({
      learningSupportId,
      studentId: a.studentId,
      status: a.status,
      markedById
    }));
    
    return await db.insert(sapetAttendance).values(records).returning();
  }

  async getAllAttendance(): Promise<SapetAttendance[]> {
    return await db.select().from(sapetAttendance);
  }

  // Departments
  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  }

  async getDepartmentById(id: number): Promise<Department | undefined> {
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
    return dept;
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [newDept] = await db.insert(departmentsTable).values(dept).returning();
    return newDept;
  }

  async updateDepartment(id: number, dept: Partial<InsertDepartment>): Promise<Department> {
    const [updated] = await db.update(departmentsTable).set(dept).where(eq(departmentsTable.id, id)).returning();
    return updated;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  }

  // Certificate Templates
  async getAllCertificateTemplates(): Promise<CertificateTemplate[]> {
    return await db.select().from(certificateTemplates).orderBy(desc(certificateTemplates.createdAt));
  }

  async getCertificateTemplateById(id: number): Promise<CertificateTemplate | undefined> {
    const [template] = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, id));
    return template;
  }

  async createCertificateTemplate(template: InsertCertificateTemplate): Promise<CertificateTemplate> {
    const [created] = await db.insert(certificateTemplates).values(template).returning();
    return created;
  }

  async updateCertificateTemplate(id: number, template: Partial<InsertCertificateTemplate>): Promise<CertificateTemplate> {
    const [updated] = await db.update(certificateTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(certificateTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteCertificateTemplate(id: number): Promise<void> {
    await db.delete(certificateTemplates).where(eq(certificateTemplates.id, id));
  }

  // Certificates
  async getAllCertificates(): Promise<(Certificate & { template: CertificateTemplate; recipient: User; issuer: User })[]> {
    const recipientAlias = db.select().from(users).as("recipient");
    const results = await db.select({
      cert: certificates,
      template: certificateTemplates,
      recipient: users,
    })
    .from(certificates)
    .innerJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
    .innerJoin(users, eq(certificates.recipientUserId, users.id))
    .orderBy(desc(certificates.issuedAt));

    const allUsers = await db.select().from(users);
    return results.map(r => ({
      ...r.cert,
      template: r.template,
      recipient: r.recipient,
      issuer: allUsers.find(u => u.id === r.cert.issuedByUserId) || r.recipient,
    }));
  }

  async getCertificateByPublicId(publicId: string): Promise<(Certificate & { template: CertificateTemplate; recipient: User; issuer: User }) | undefined> {
    const results = await db.select({
      cert: certificates,
      template: certificateTemplates,
      recipient: users,
    })
    .from(certificates)
    .innerJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
    .innerJoin(users, eq(certificates.recipientUserId, users.id))
    .where(eq(certificates.publicId, publicId))
    .limit(1);

    if (results.length === 0) return undefined;
    const r = results[0];
    const [issuer] = await db.select().from(users).where(eq(users.id, r.cert.issuedByUserId));
    return {
      ...r.cert,
      template: r.template,
      recipient: r.recipient,
      issuer: issuer || r.recipient,
    };
  }

  async getCertificateById(id: number): Promise<Certificate | undefined> {
    const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
    return cert;
  }

  async createCertificate(cert: InsertCertificate): Promise<Certificate> {
    const [created] = await db.insert(certificates).values(cert).returning();
    return created;
  }

  async updateCertificate(id: number, cert: Partial<InsertCertificate>): Promise<Certificate> {
    const [updated] = await db.update(certificates).set(cert).where(eq(certificates.id, id)).returning();
    return updated;
  }

  async getCertificatesByRecipient(userId: number): Promise<(Certificate & { template: CertificateTemplate })[]> {
    const results = await db.select({
      cert: certificates,
      template: certificateTemplates,
    })
    .from(certificates)
    .innerJoin(certificateTemplates, eq(certificates.templateId, certificateTemplates.id))
    .where(eq(certificates.recipientUserId, userId))
    .orderBy(desc(certificates.issuedAt));

    return results.map(r => ({ ...r.cert, template: r.template }));
  }
}

export const storage = new DatabaseStorage();
