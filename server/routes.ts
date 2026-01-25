import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";
import { startOfWeek, endOfWeek, addDays, format, getDay } from "date-fns";
import { examEvents, subjects, users, students, settings, classes } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

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
      if (count >= 3) {
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
    res.sendStatus(200);
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

  // === USERS/STUDENTS ===
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
         
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', 'attachment; filename=schedule.pdf');
         doc.pipe(res);

         // Helper for colors (modern palette)
         const colors = {
           primary: '#0f172a',
           secondary: '#64748b',
           border: '#e2e8f0',
           examBg: '#f5f3ff',
           examBorder: '#c4b5fd',
           examText: '#5b21b6',
           quizBg: '#fffbeb',
           quizBorder: '#fcd34d',
           quizText: '#92400e',
           mutedBg: '#f8fafc'
         };

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
         const periodColWidth = 60;
         const dayColWidth = (tableWidth - periodColWidth) / 5;
         const cellHeight = 55;
         const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
         const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
         
         // Draw Header (Days)
         doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primary);
         shortDays.forEach((day, i) => {
           const x = startX + periodColWidth + (i * dayColWidth);
           doc.text(day.toUpperCase(), x, startY - 20, { width: dayColWidth, align: 'center' });
           const dateStr = format(addDays(weekStart, i), 'MMM d');
           doc.font('Helvetica').fontSize(8).fillColor(colors.secondary)
              .text(dateStr, x, startY - 10, { width: dayColWidth, align: 'center' });
         });

         // Draw Grid and Content
         for (let p = 1; p <= 8; p++) {
           const y = startY + (p - 1) * cellHeight;
           
           // Period Label
           doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary)
              .text(`${p}`, startX, y + cellHeight/2 - 12, { width: periodColWidth, align: 'center' });
           doc.font('Helvetica').fontSize(7).fillColor(colors.secondary)
              .text('PERIOD', startX, y + cellHeight/2 + 2, { width: periodColWidth, align: 'center' });

           days.forEach((day, i) => {
             const x = startX + periodColWidth + (i * dayColWidth);
             
             // Draw Cell Border
             doc.rect(x, y, dayColWidth, cellHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
             
             // Friday restriction
             if (day === 'Friday' && p > 4) {
               doc.rect(x + 0.5, y + 0.5, dayColWidth - 1, cellHeight - 1).fill(colors.mutedBg);
               return;
             }

             const date = addDays(weekStart, i);
             const dayExams = exams.filter(e => {
               const eDate = new Date(e.date);
               return eDate.getDate() === date.getDate() && 
                      eDate.getMonth() === date.getMonth() &&
                      e.period === p;
             });

             if (dayExams.length > 0) {
               dayExams.forEach((e, idx) => {
                 const isExam = e.type === 'EXAM';
                 const margin = 3;
                 const boxHeight = (cellHeight - (margin * 2));
                 
                 // Rounded box for exam
                 doc.roundedRect(x + margin, y + margin, dayColWidth - (margin * 2), boxHeight, 4)
                    .fillAndStroke(isExam ? colors.examBg : colors.quizBg, isExam ? colors.examBorder : colors.quizBorder);
                 
                 doc.fontSize(8).font('Helvetica-Bold').fillColor(isExam ? colors.examText : colors.quizText)
                    .text(e.subject.code, x + margin + 4, y + margin + 6, { width: dayColWidth - 14 });
                 
                 doc.fontSize(7).font('Helvetica').fillColor(isExam ? colors.examText : colors.quizText)
                    .text(`${e.class.name} • ${e.type}`, x + margin + 4, y + margin + 18, { width: dayColWidth - 14 });
                 
                 doc.fontSize(6).text(`Prof: ${e.creator.name}`, x + margin + 4, y + margin + 30, { width: dayColWidth - 14 });
               });
             }
           });
         }

         doc.end();
     } catch (err) {
         console.error(err);
         res.status(500).send("Error generating PDF");
     }
  });

  // === SEED DATA ===
  await seed();

  return httpServer;
}

async function seed() {
    const existingUsers = await storage.getAllUsers();
    if (existingUsers.length === 0) {
        const passwordHash = await bcrypt.hash("password123", 10);
        
        await storage.createUser({
            username: "admin",
            password: passwordHash,
            role: "ADMIN",
            name: "Admin User",
            email: "admin@school.com",
            isActive: true
        });
        
        await storage.createUser({
            username: "coordinator",
            password: passwordHash,
            role: "COORDINATOR",
            name: "Schedule Coordinator",
            email: "coord@school.com",
            isActive: true
        });

        await storage.createUser({
            username: "principal",
            password: passwordHash,
            role: "PRINCIPAL",
            name: "Principal Skinner",
            email: "principal@school.com",
            isActive: true
        });
        
        await storage.createUser({
            username: "teacher1",
            password: passwordHash,
            role: "TEACHER",
            name: "John Keating",
            email: "keating@school.com",
            isActive: true
        });
        
        await storage.createUser({
            username: "teacher2",
            password: passwordHash,
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
