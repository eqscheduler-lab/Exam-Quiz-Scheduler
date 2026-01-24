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
         
         const doc = new PDFDocument({ layout: 'landscape', size: 'A4' });
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', 'attachment; filename=schedule.pdf');
         doc.pipe(res);

         // Header
         doc.fontSize(20).text('Exam & Quiz Schedule', { align: 'center' });
         doc.fontSize(12).text(`Week of ${format(weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`, { align: 'center' });
         doc.moveDown();

         // Grid Configuration
         const startX = 50;
         const startY = 120;
         const cellWidth = 90;
         const cellHeight = 80;
         const periods = 8;
         const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
         
         // Draw Header Row (Periods)
         doc.font('Helvetica-Bold');
         for (let p = 1; p <= periods; p++) {
             doc.text(`Period ${p}`, startX + 50 + (p-1) * cellWidth, startY - 20, { width: cellWidth, align: 'center' });
         }
         
         // Draw Rows (Days) & Grid
         doc.font('Helvetica');
         days.forEach((day, i) => {
             const y = startY + i * cellHeight;
             doc.font('Helvetica-Bold').text(day, startX, y + cellHeight/2 - 5);
             
             // Draw horizontal line
             doc.moveTo(startX, y).lineTo(startX + 50 + periods * cellWidth, y).stroke();
             
             // Draw cells
             for (let p = 1; p <= periods; p++) {
                 const x = startX + 50 + (p-1) * cellWidth;
                 if (day === 'Fri' && p > 4) {
                     doc.rect(x, y, cellWidth, cellHeight).fill('#f0f0f0');
                     doc.fillColor('black'); // Reset
                     continue;
                 }
                 
                 const date = addDays(weekStart, i);
                 const dayExams = exams.filter(e => {
                     const eDate = new Date(e.date);
                     return eDate.getDate() === date.getDate() && 
                            eDate.getMonth() === date.getMonth() &&
                            e.period === p;
                 });
                 
                 if (dayExams.length > 0) {
                     doc.fontSize(8);
                     let textY = y + 5;
                     dayExams.forEach(e => {
                         doc.font('Helvetica-Bold').text(e.class.name, x + 2, textY, { width: cellWidth - 4 });
                         doc.font('Helvetica').text(e.subject.code, x + 2, textY + 10, { width: cellWidth - 4 });
                         doc.text(e.type, x + 2, textY + 20, { width: cellWidth - 4 });
                         textY += 35;
                     });
                 }
                 
                 doc.moveTo(x, y).lineTo(x, y + cellHeight).stroke();
             }
             doc.moveTo(startX + 50 + periods * cellWidth, y).lineTo(startX + 50 + periods * cellWidth, y + cellHeight).stroke();
         });
         
         doc.moveTo(startX, startY + days.length * cellHeight).lineTo(startX + 50 + periods * cellWidth, startY + days.length * cellHeight).stroke();

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
