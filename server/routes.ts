import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
// @ts-ignore
import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";
import { startOfWeek, endOfWeek, addDays, format, getDay } from "date-fns";
import { insertUserSchema, BELL_SCHEDULES, getGradeLevel, examEvents, subjects, users, students, settings, classes } from "../shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Set timezone for the process (Asia/Dubai)
  process.env.TZ = "Asia/Dubai";

  // === EXAMS ===
  app.get(api.exams.list.path, async (req, res) => {
    const filters = {
       weekStart: req.query.weekStart ? new Date(req.query.weekStart as string) : undefined,
       weekEnd: req.query.weekStart ? endOfWeek(new Date(req.query.weekStart as string), { weekStartsOn: 1 }) : undefined,
       classId: req.query.classId ? Number(req.query.classId) : undefined,
       teacherId: req.query.teacherId ? Number(req.query.teacherId) : undefined,
    };
    
    const exams = await storage.getExams(filters);
    res.json(exams);
  });

  app.post(api.exams.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const input = api.exams.create.input.parse(req.body);
      
      const date = new Date(input.date);
      const dayOfWeek = getDay(date);
      const isFriday = dayOfWeek === 5;
      
      const maxPeriods = isFriday ? 4 : 8;
      if (input.period > maxPeriods) {
        return res.status(400).json({ 
            message: `Invalid period. ${isFriday ? 'Friday' : 'Mon-Thu'} has max ${maxPeriods} periods.` 
        });
      }

      const count = await storage.getExamCountForClassDay(date, input.classId);
      if (count >= 2) {
        return res.status(400).json({ 
            message: "The maximum number of exams is reached, please choose another day to conduct your exam." 
        });
      }
      
      const user = req.user as any;
      const createdByUserId = user.id;

      const exam = await storage.createExam({ ...input, createdByUserId });
      res.status(201).json(exam);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });
  
  app.patch(api.exams.update.path, async (req, res) => {
     if (!req.isAuthenticated()) return res.sendStatus(401);
     try {
       const input = api.exams.update.input.parse(req.body);
       const exam = await storage.updateExam(Number(req.params.id), input);
       res.json(exam);
     } catch (err) {
       res.status(400).json({ message: "Update failed" });
     }
  });

  // === CLASSES ===
  app.get("/api/classes", async (req, res) => {
    try {
      const classesData = await storage.getAllClasses();
      res.json(classesData);
    } catch (err) {
      console.error("Get classes error:", err);
      res.status(500).json({ message: "Failed to fetch classes" });
    }
  });

  app.post("/api/classes", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      if (!req.body.name) {
        return res.status(400).json({ message: "Class name is required" });
      }
      const newClass = await storage.createClass(req.body);
      res.json(newClass);
    } catch (err) {
      console.error("Create class error:", err);
      res.status(500).json({ message: "Failed to create class" });
    }
  });

  app.delete("/api/classes/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      const classId = parseInt(req.params.id);
      await storage.deleteClass(classId);
      res.sendStatus(200);
    } catch (error: any) {
      console.error("Delete class error:", error);
      // Check for foreign key constraint error (class has exams)
      if (error.message?.includes("foreign key constraint")) {
        return res.status(400).json({ message: "Cannot delete class that has scheduled exams. Remove the exams first." });
      }
      res.status(500).json({ message: error.message || "Failed to delete class" });
    }
  });

  // === SUBJECTS ===
  app.get(api.subjects.list.path, async (req, res) => {
    const subjectsList = await storage.getAllSubjects();
    res.json(subjectsList);
  });
  
  app.post(api.subjects.create.path, async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'ADMIN') return res.sendStatus(401);
    const input = api.subjects.create.input.parse(req.body);
    const subject = await storage.createSubject(input);
    res.status(201).json(subject);
  });

  app.patch("/api/subjects/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'ADMIN') return res.sendStatus(403);
    try {
      const subjectId = parseInt(req.params.id);
      const { name, code } = req.body;
      const subject = await storage.updateSubject(subjectId, { name, code });
      res.json(subject);
    } catch (error: any) {
      console.error("Update subject error:", error);
      res.status(500).json({ message: error.message || "Failed to update subject" });
    }
  });

  app.delete("/api/subjects/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== 'ADMIN') return res.sendStatus(403);
    try {
      const subjectId = parseInt(req.params.id);
      await storage.deleteSubject(subjectId);
      res.sendStatus(200);
    } catch (error: any) {
      console.error("Delete subject error:", error);
      if (error.message?.includes("foreign key constraint")) {
        return res.status(400).json({ message: "Cannot delete subject that has scheduled exams. Remove the exams first." });
      }
      res.status(500).json({ message: error.message || "Failed to delete subject" });
    }
  });

  // === USERS/STUDENTS ===
  app.post("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      // Parse without password - server sets default password
      const createStaffSchema = insertUserSchema.omit({ password: true });
      const data = createStaffSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash("Staff123", 10);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      res.status(201).json(user);
    } catch (error: any) {
      console.error("Create user error:", error);
      res.status(400).json({ message: error.message || "Failed to create user" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      const userId = parseInt(req.params.id);
      // Don't allow deleting yourself
      if (userId === (req.user as any).id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      // Deactivate user instead of deleting to preserve data integrity
      await storage.updateUser(userId, { isActive: false });
      res.sendStatus(200);
    } catch (error: any) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  });

  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).send("Current and new password are required");
    const user = req.user as any;
    const dbUser = await storage.getUser(user.id);
    if (!dbUser) return res.sendStatus(404);
    const isMatch = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isMatch) return res.status(400).send("Incorrect current password");
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(dbUser.id, { password: hashedPassword });
    res.sendStatus(200);
  });

  app.get(api.users.list.path, async (req, res) => {
     if (!req.isAuthenticated()) return res.sendStatus(401);
     const usersList = await storage.getAllUsers();
     res.json(usersList);
  });

  app.get(api.students.list.path, async (req, res) => {
     if (!req.isAuthenticated()) return res.sendStatus(401);
     const studentsList = await storage.getAllStudents();
     res.json(studentsList);
  });

  // === PDF EXPORT ===
  app.get(api.schedule.pdf.path, async (req, res) => {
     try {
         const weekStartStr = req.query.weekStart as string;
         const weekStart = new Date(weekStartStr);
         const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
         const classId = req.query.classId ? Number(req.query.classId) : undefined;
         
         const exams = await storage.getExams({ weekStart, weekEnd, classId });
         
         const doc = new PDFDocument({ 
           layout: 'landscape', 
           size: 'A4',
           margins: { top: 30, left: 30, right: 30, bottom: 30 }
         });
         
         const extractionDate = format(new Date(), 'yyyy-MM-dd');
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', `attachment; filename="Exam Schedule ${extractionDate}.pdf"`);
         doc.pipe(res);

         // Helper for colors (modern palette)
         const colors = {
           primary: '#0f172a',
           secondary: '#64748b',
           border: '#e2e8f0',
           mutedBg: '#f8fafc'
         };

         // Distinct class color palette (20 unique colors)
         const classColorPalette = [
           { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },  // Blue
           { bg: '#dcfce7', border: '#22c55e', text: '#166534' },  // Green
           { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },  // Amber
           { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },  // Pink
           { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },  // Indigo
           { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59' },  // Teal
           { bg: '#fed7aa', border: '#f97316', text: '#9a3412' },  // Orange
           { bg: '#f5d0fe', border: '#d946ef', text: '#86198f' },  // Fuchsia
           { bg: '#cffafe', border: '#06b6d4', text: '#155e75' },  // Cyan
           { bg: '#fecaca', border: '#ef4444', text: '#991b1b' },  // Red
           { bg: '#d9f99d', border: '#84cc16', text: '#3f6212' },  // Lime
           { bg: '#c7d2fe', border: '#818cf8', text: '#4338ca' },  // Violet
           { bg: '#fbcfe8', border: '#f472b6', text: '#be185d' },  // Rose
           { bg: '#a7f3d0', border: '#10b981', text: '#065f46' },  // Emerald
           { bg: '#bfdbfe', border: '#60a5fa', text: '#1e3a8a' },  // Sky
           { bg: '#fde68a', border: '#eab308', text: '#713f12' },  // Yellow
           { bg: '#e9d5ff', border: '#a855f7', text: '#6b21a8' },  // Purple
           { bg: '#99f6e4', border: '#2dd4bf', text: '#0f766e' },  // Aqua
           { bg: '#fecdd3', border: '#fb7185', text: '#881337' },  // Coral
           { bg: '#bbf7d0', border: '#4ade80', text: '#15803d' },  // Light Green
         ];

         // Build class-to-color mapping (sorted by name for consistent colors)
         const allClasses = await storage.getAllClasses();
         const sortedClasses = [...allClasses].sort((a, b) => a.name.localeCompare(b.name));
         const classColorMap = new Map<number, typeof classColorPalette[0]>();
         sortedClasses.forEach((cls, index) => {
           classColorMap.set(cls.id, classColorPalette[index % classColorPalette.length]);
         });
         console.log("Class color mapping:", Array.from(classColorMap.entries()).map(([id, c]) => ({ id, color: c.bg })));

         // Header
         doc.font('Helvetica-Bold').fontSize(24).fillColor(colors.primary)
            .text('Exam & Quiz Schedule', { align: 'center' });
         doc.fontSize(12).fillColor(colors.secondary)
            .text(`${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`, { align: 'center' });
         
         if (classId) {
           const allClass = await storage.getAllClasses();
           const cls = allClass.find(c => c.id === classId);
           if (cls) {
             doc.moveDown(0.5).fontSize(14).fillColor(colors.primary)
                .text(`Class: ${cls.name}`, { align: 'center' });
           }
         } else {
           doc.moveDown(0.5).fontSize(14).fillColor(colors.primary)
              .text(`Whole School Schedule`, { align: 'center' });
         }
         doc.moveDown(1);

         // Grid Configuration
         const startX = 40;
         const startY = 130;
         const tableWidth = doc.page.width - 80;
         const dayColWidth = 100; // Fixed width for day labels
         const periodColWidth = (tableWidth - dayColWidth) / 8;
         const cellHeight = 70;
         const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
         const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
         
         // Draw Header (Periods)
         doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primary);
         for (let p = 1; p <= 8; p++) {
           const x = startX + dayColWidth + ((p - 1) * periodColWidth);
           doc.text(`P${p}`, x, startY - 20, { width: periodColWidth, align: 'center' });
           doc.font('Helvetica').fontSize(7).fillColor(colors.secondary)
              .text('PERIOD', x, startY - 10, { width: periodColWidth, align: 'center' });
         }

         // Draw Grid and Content
         days.forEach((day, i) => {
           const y = startY + (i * cellHeight);
           const date = addDays(weekStart, i);
           const isFri = day === 'Friday';
           
           // Day Label
           doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.primary)
              .text(day.toUpperCase(), startX, y + cellHeight/2 - 10, { width: dayColWidth });
           doc.font('Helvetica').fontSize(8).fillColor(colors.secondary)
              .text(format(date, 'MMM d'), startX, y + cellHeight/2 + 2, { width: dayColWidth });

           for (let p = 1; p <= 8; p++) {
             const x = startX + dayColWidth + ((p - 1) * periodColWidth);
             
             // Draw Cell Border
             doc.rect(x, y, periodColWidth, cellHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
             
             // Friday restriction
             if (isFri && p > 4) {
               doc.rect(x + 0.5, y + 0.5, periodColWidth - 1, cellHeight - 1).fill(colors.mutedBg);
               continue;
             }

             const dayExams = exams.filter(e => {
               const eDate = new Date(e.date);
               return eDate.getDate() === date.getDate() && 
                      eDate.getMonth() === date.getMonth() &&
                      e.period === p;
             });

             if (dayExams.length > 0) {
               dayExams.forEach((e) => {
                 const margin = 2;
                 const boxHeight = cellHeight - (margin * 2);
                 const boxWidth = periodColWidth - (margin * 2);
                 
                 // Get class-specific color
                 console.log("Exam classId:", e.classId, "class name:", e.class?.name, "has mapping:", classColorMap.has(e.classId));
                 const classColor = classColorMap.get(e.classId) || classColorPalette[0];
                 
                 // Rounded box for exam with class color
                 doc.roundedRect(x + margin, y + margin, boxWidth, boxHeight, 3)
                    .fillAndStroke(classColor.bg, classColor.border);
                 
                 doc.fillColor(classColor.text);
                 
                 // Subject code
                 doc.fontSize(7).font('Helvetica-Bold')
                    .text(e.subject.code, x + margin + 3, y + margin + 4, { width: boxWidth - 6, align: 'center' });
                 
                 // Class name (condensed)
                 doc.fontSize(6).font('Helvetica')
                    .text(e.class.name, x + margin + 3, y + margin + 14, { width: boxWidth - 6, align: 'center' });
                 
                 // Get Bell Time
                 const gradeLevel = getGradeLevel(e.class.name);
                 const schedule = isFri ? BELL_SCHEDULES[gradeLevel].FRI : BELL_SCHEDULES[gradeLevel].MON_THU;
                 const timeRange = (schedule as any)[p] || "";

                 // Type & Creator
                 doc.fontSize(5)
                    .text(`${e.type} | ${timeRange}`, x + margin + 3, y + margin + 24, { width: boxWidth - 6, align: 'center' });
                 
                 const creatorLastName = e.creator.name.split(' ').pop();
                 doc.text(`Prof: ${creatorLastName}`, x + margin + 3, y + margin + 34, { width: boxWidth - 6, align: 'center' });
               });
             }
           }
         });

         doc.end();
     } catch (err) {
         console.error(err);
         res.status(500).send("Error generating PDF");
     }
  });

  // === LOGIN AUDIT (Admin only) ===
  app.get("/api/admin/login-audit", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") {
      return res.sendStatus(403);
    }
    try {
      const logs = await storage.getLoginAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Login audit error:", error);
      res.status(500).json({ message: "Failed to fetch login audit logs" });
    }
  });

  // === ANALYTICS (Admin, Principal, Vice Principal) ===
  app.get("/api/analytics", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any).role;
    if (!["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"].includes(role)) {
      return res.sendStatus(403);
    }
    try {
      const analytics = await storage.getExamAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // === SEED DATA ===
  // Generate fresh hashes on each startup to ensure passwords work
  const adminHash = await bcrypt.hash("Man@4546161", 10);
  const admin2Hash = await bcrypt.hash("Staff@123", 10);
  const staffDefaultHash = await bcrypt.hash("Staff123", 10);
  
  // Force update admin passwords on start to ensure they work
  const adminUser = await storage.getUserByUsername("admin");
  if (adminUser) {
    console.log("Found admin user, updating password with known hash...");
    await storage.updateUser(adminUser.id, { password: adminHash });
  } else {
    console.log("Admin user not found, creating with known hash...");
    await storage.createUser({
      username: "admin",
      password: adminHash,
      role: "ADMIN",
      name: "Admin User",
      email: "admin@school.com",
      isActive: true
    });
  }

  const admin2User = await storage.getUserByUsername("admin2");
  if (admin2User) {
    console.log("Found admin2 user, updating password with known hash...");
    await storage.updateUser(admin2User.id, { password: admin2Hash });
  } else {
    console.log("Admin2 user not found, creating with known hash...");
    await storage.createUser({
      username: "admin2",
      password: admin2Hash,
      role: "ADMIN",
      name: "System Admin",
      email: "admin2@school.com",
      isActive: true
    });
  }

  await seed();

  return httpServer;
}

async function seed() {
    const existingUsers = await storage.getAllUsers();
    if (existingUsers.length === 0) {
        const passwordHash = await bcrypt.hash("Man@4546161", 10);
        
        await storage.createUser({
            username: "admin",
            password: passwordHash,
            role: "ADMIN",
            name: "Admin User",
            email: "admin@school.com",
            isActive: true
        });

        const coordHash = await bcrypt.hash("Staff123", 10);
        
        await storage.createUser({
            username: "coordinator",
            password: coordHash,
            role: "COORDINATOR",
            name: "Schedule Coordinator",
            email: "coord@school.com",
            isActive: true
        });

        await storage.createUser({
            username: "principal",
            password: coordHash,
            role: "PRINCIPAL",
            name: "Principal Skinner",
            email: "principal@school.com",
            isActive: true
        });
        
        await storage.createUser({
            username: "teacher1",
            password: coordHash,
            role: "TEACHER",
            name: "John Keating",
            email: "keating@school.com",
            isActive: true
        });
        
        await storage.createUser({
            username: "teacher2",
            password: coordHash,
            role: "TEACHER",
            name: "Sherman Klump",
            email: "klump@school.com",
            isActive: true
        });

        await storage.createSubject({ name: "Mathematics", code: "MATH101" });
        await storage.createSubject({ name: "Physics", code: "PHYS101" });
        await storage.createSubject({ name: "Chemistry", code: "CHEM101" });
        await storage.createSubject({ name: "English", code: "ENG101" });
        await storage.createSubject({ name: "Computer Science", code: "CS101" });
    }
}
