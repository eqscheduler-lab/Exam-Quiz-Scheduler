import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
// @ts-ignore
import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";
import multer from "multer";
import { startOfWeek, endOfWeek, addDays, format, getDay } from "date-fns";
import { insertUserSchema, BELL_SCHEDULES, getGradeLevel, examEvents, subjects, users, students, settings, classes, userRoles } from "../shared/schema";
import { getSendGridClient } from "./sendgrid";

const upload = multer({ storage: multer.memoryStorage() });

// Helper function to get week dates based on term and week number
// Academic year starts in September
function getWeekDates(term: string, weekNumber: number): { weekStartDate: Date; weekEndDate: Date } {
  // Assuming academic year starts in September
  const currentYear = new Date().getFullYear();
  let termStartMonth: number;
  
  switch (term) {
    case "TERM_1":
      termStartMonth = 8; // September (0-indexed)
      break;
    case "TERM_2":
      termStartMonth = 0; // January
      break;
    case "TERM_3":
      termStartMonth = 4; // May
      break;
    default:
      termStartMonth = 8;
  }
  
  // Calculate the year for the term
  let year = currentYear;
  if (term === "TERM_2" || term === "TERM_3") {
    // If we're in the first half of the year, these terms are in the current year
    // If we're in the second half, they're in the next year
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 8) {
      year = currentYear + 1;
    }
  }
  
  // Calculate week start date (Monday of that week)
  const termStart = new Date(year, termStartMonth, 1);
  const weekStart = addDays(termStart, (weekNumber - 1) * 7);
  const weekEnd = addDays(weekStart, 6);
  
  return {
    weekStartDate: weekStart,
    weekEndDate: weekEnd
  };
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    rows.push(row);
  }
  
  return rows;
}

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
      const dateStr = date.toISOString().split('T')[0];
      console.log(`[BOOKING] Attempting to create ${input.type} for class ${input.classId} on ${dateStr} period ${input.period}`);
      
      const dayOfWeek = getDay(date);
      const isFriday = dayOfWeek === 5;
      
      const maxPeriods = isFriday ? 4 : 8;
      if (input.period > maxPeriods) {
        return res.status(400).json({ 
            message: `Invalid period. ${isFriday ? 'Friday' : 'Mon-Thu'} has max ${maxPeriods} periods.` 
        });
      }

      // Check if there's already a booking for this period/class/day
      const existingBooking = await storage.getExistingBooking(date, input.period, input.classId);
      console.log(`[BOOKING] Existing booking check: ${existingBooking ? 'FOUND - ' + existingBooking.title : 'None'}`);
      if (existingBooking) {
        return res.status(400).json({ 
            message: "This period already has a booking for this class. Please choose another period." 
        });
      }

      // Only quizzes are limited to 1 per day per class; homework has no limit
      if (input.type === "QUIZ") {
        const quizCount = await storage.getQuizCountForClassDay(date, input.classId);
        console.log(`[BOOKING] Quiz count for class ${input.classId} on ${dateStr}: ${quizCount}`);
        if (quizCount >= 1) {
          return res.status(400).json({ 
              message: "Only one quiz is allowed per class per day. Please choose another day." 
          });
        }
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
       const examId = Number(req.params.id);
       const user = req.user as any;
       
       // Get the exam to check ownership
       const exams = await storage.getExams({});
       const exam = exams.find(e => e.id === examId);
       
       if (!exam) {
         return res.status(404).json({ message: "Booking not found" });
       }
       
       // Only allow creator or admin to modify
       if (exam.createdByUserId !== user.id && user.role !== "ADMIN") {
         return res.status(403).json({ message: "You can only modify your own bookings" });
       }
       
       const input = api.exams.update.input.parse(req.body);
       const updatedExam = await storage.updateExam(examId, input);
       res.json(updatedExam);
     } catch (err) {
       res.status(400).json({ message: "Update failed" });
     }
  });

  // Cancel exam (set status to CANCELLED)
  app.patch("/api/exams/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const examId = Number(req.params.id);
      const user = req.user as any;
      
      // Get the exam to check ownership
      const exams = await storage.getExams({});
      const exam = exams.find(e => e.id === examId);
      
      if (!exam) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Only allow creator or admin to cancel
      if (exam.createdByUserId !== user.id && user.role !== "ADMIN") {
        return res.status(403).json({ message: "You can only cancel your own bookings" });
      }
      
      const updatedExam = await storage.updateExam(examId, { status: "CANCELLED" });
      res.json(updatedExam);
    } catch (err) {
      console.error("Cancel exam error:", err);
      res.status(400).json({ message: "Failed to cancel booking" });
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

  app.patch("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      const userId = parseInt(req.params.id);
      const { name, email, role, isActive } = req.body;
      await storage.updateUser(userId, { name, email, role, isActive });
      res.sendStatus(200);
    } catch (error: any) {
      console.error("Update user error:", error);
      res.status(500).json({ message: error.message || "Failed to update user" });
    }
  });

  // Password Reset - Admin Only
  app.post("/api/admin/users/:id/reset-password", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      const userId = parseInt(req.params.id);
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { password: hashedPassword });
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: error.message || "Failed to reset password" });
    }
  });

  // Factory Reset - Admin Only
  app.post("/api/admin/factory-reset", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    try {
      await storage.factoryReset();
      res.json({ message: "Factory reset complete" });
    } catch (error: any) {
      console.error("Factory reset error:", error);
      res.status(500).json({ message: error.message || "Failed to reset" });
    }
  });

  // === BULK IMPORT ===
  app.post("/api/admin/bulk-import/staff", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const content = req.file.buffer.toString("utf-8");
      const rows = parseCSV(content);
      
      if (rows.length === 0) {
        return res.status(400).json({ message: "CSV file is empty or invalid format" });
      }
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      const defaultPassword = await bcrypt.hash("Staff123", 10);
      
      for (const row of rows) {
        try {
          const { name, username, email, role } = row;
          
          if (!name || !username || !email || !role) {
            errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
            failed++;
            continue;
          }
          
          const normalizedRole = role.toUpperCase();
          if (!userRoles.includes(normalizedRole as any)) {
            errors.push(`Invalid role "${role}" for user ${username}. Valid roles: ${userRoles.join(", ")}`);
            failed++;
            continue;
          }
          
          await storage.createUser({
            name,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            role: normalizedRole as typeof userRoles[number],
            password: defaultPassword,
            isActive: true,
          });
          success++;
        } catch (error: any) {
          errors.push(`Failed to import ${row.username || "unknown"}: ${error.message}`);
          failed++;
        }
      }
      
      res.json({ success, failed, errors });
    } catch (error: any) {
      console.error("Staff import error:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  app.post("/api/admin/bulk-import/subjects", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const content = req.file.buffer.toString("utf-8");
      const rows = parseCSV(content);
      
      if (rows.length === 0) {
        return res.status(400).json({ message: "CSV file is empty or invalid format" });
      }
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const row of rows) {
        try {
          const { code, name } = row;
          
          if (!code || !name) {
            errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
            failed++;
            continue;
          }
          
          await storage.createSubject({ code: code.toUpperCase(), name });
          success++;
        } catch (error: any) {
          errors.push(`Failed to import ${row.code || "unknown"}: ${error.message}`);
          failed++;
        }
      }
      
      res.json({ success, failed, errors });
    } catch (error: any) {
      console.error("Subjects import error:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  app.post("/api/admin/bulk-import/classes", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated() || (req.user as any).role !== "ADMIN") return res.sendStatus(403);
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const content = req.file.buffer.toString("utf-8");
      const rows = parseCSV(content);
      
      if (rows.length === 0) {
        return res.status(400).json({ message: "CSV file is empty or invalid format" });
      }
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      
      for (const row of rows) {
        try {
          const { name } = row;
          
          if (!name) {
            errors.push(`Row missing class name: ${JSON.stringify(row)}`);
            failed++;
            continue;
          }
          
          await storage.createClass({ name });
          success++;
        } catch (error: any) {
          errors.push(`Failed to import ${row.name || "unknown"}: ${error.message}`);
          failed++;
        }
      }
      
      res.json({ success, failed, errors });
    } catch (error: any) {
      console.error("Classes import error:", error);
      res.status(500).json({ message: error.message || "Import failed" });
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
         const classIdsStr = req.query.classIds as string | undefined;
         const classIds = classIdsStr ? classIdsStr.split(',').map(Number).filter(n => !isNaN(n)) : undefined;
         
         const doc = new PDFDocument({ 
           layout: 'landscape', 
           size: 'A4',
           margins: { top: 30, left: 30, right: 30, bottom: 30 }
         });
         
         const scheduleWeekDate = format(weekStart, 'yyyy-MM-dd');
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', `attachment; filename="Exam Schedule ${scheduleWeekDate}.pdf"`);
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

         // Grid Configuration
         const startX = 40;
         const startY = 130;
         const tableWidth = doc.page.width - 80;
         const dayColWidth = 100;
         const periodColWidth = (tableWidth - dayColWidth) / 8;
         const cellHeight = 70;
         const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

         // Helper function to draw a schedule page for a specific class
         const drawSchedulePage = async (targetClassId: number | undefined, className: string, exams: any[]) => {
           // Header
           doc.font('Helvetica-Bold').fontSize(24).fillColor(colors.primary)
              .text('HW & Quiz Schedule', { align: 'center' });
           doc.fontSize(12).fillColor(colors.secondary)
              .text(`${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`, { align: 'center' });
           
           doc.moveDown(0.5).fontSize(14).fillColor(colors.primary)
              .text(`Class: ${className}`, { align: 'center' });
           doc.moveDown(1);

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
                 return;
               }

               const dateStr = format(date, 'yyyy-MM-dd');
               const dayExams = exams.filter(e => {
                 const examDateStr = format(new Date(e.date), 'yyyy-MM-dd');
                 return examDateStr === dateStr && e.period === p;
               });

               if (dayExams.length > 0) {
                 const numExams = dayExams.length;
                 dayExams.forEach((e, examIndex) => {
                   const margin = 2;
                   const totalHeight = cellHeight - (margin * 2);
                   const boxHeight = numExams > 1 ? (totalHeight / numExams) - 1 : totalHeight;
                   const boxWidth = periodColWidth - (margin * 2);
                   const yOffset = examIndex * (boxHeight + 1);
                   
                   // Get class-specific color
                   const classColor = classColorMap.get(e.classId) || classColorPalette[0];
                   
                   // Rounded box for exam with class color
                   doc.roundedRect(x + margin, y + margin + yOffset, boxWidth, boxHeight, 3)
                      .fillAndStroke(classColor.bg, classColor.border);
                   
                   doc.fillColor(classColor.text);
                   
                   if (numExams === 1) {
                     // Full layout for single exam
                     doc.fontSize(7).font('Helvetica-Bold')
                        .text(e.subject.code, x + margin + 3, y + margin + 4, { width: boxWidth - 6, align: 'center' });
                     doc.fontSize(6).font('Helvetica')
                        .text(e.class.name, x + margin + 3, y + margin + 14, { width: boxWidth - 6, align: 'center' });
                     const gradeLevel = getGradeLevel(e.class.name);
                     const schedule = isFri ? BELL_SCHEDULES[gradeLevel].FRI : BELL_SCHEDULES[gradeLevel].MON_THU;
                     const timeRange = (schedule as any)[p] || "";
                     doc.fontSize(5)
                        .text(`${e.type} | ${timeRange}`, x + margin + 3, y + margin + 24, { width: boxWidth - 6, align: 'center' });
                     doc.text(e.creator.name, x + margin + 3, y + margin + 34, { width: boxWidth - 6, align: 'center' });
                   } else {
                     // Compact layout for multiple exams - include teacher name
                     doc.fontSize(6).font('Helvetica-Bold')
                        .text(e.subject.code, x + margin + 2, y + margin + yOffset + 2, { width: boxWidth - 4, align: 'center' });
                     doc.fontSize(5).font('Helvetica')
                        .text(`${e.class.name} - ${e.type}`, x + margin + 2, y + margin + yOffset + 9, { width: boxWidth - 4, align: 'center' });
                     doc.fontSize(4)
                        .text(e.creator.name, x + margin + 2, y + margin + yOffset + 15, { width: boxWidth - 4, align: 'center' });
                   }
                 });
               }
             }
           });
         };

         // Generate pages based on selection
         if (classIds && classIds.length > 0) {
           // Multi-class export: each class on its own page
           for (let i = 0; i < classIds.length; i++) {
             const cId = classIds[i];
             const cls = allClasses.find(c => c.id === cId);
             if (!cls) continue;
             
             const classExams = await storage.getExams({ weekStart, weekEnd, classId: cId });
             
             if (i > 0) {
               doc.addPage();
             }
             
             await drawSchedulePage(cId, cls.name, classExams);
           }
         } else if (classId) {
           // Single class export
           const cls = allClasses.find(c => c.id === classId);
           const exams = await storage.getExams({ weekStart, weekEnd, classId });
           await drawSchedulePage(classId, cls?.name || 'Unknown', exams);
         } else {
           // Whole school - single page with all exams
           const exams = await storage.getExams({ weekStart, weekEnd });
           
           // Header
           doc.font('Helvetica-Bold').fontSize(24).fillColor(colors.primary)
              .text('HW & Quiz Schedule', { align: 'center' });
           doc.fontSize(12).fillColor(colors.secondary)
              .text(`${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`, { align: 'center' });
           doc.moveDown(0.5).fontSize(14).fillColor(colors.primary)
              .text(`Whole School Schedule`, { align: 'center' });
           doc.moveDown(1);

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
             
             doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.primary)
                .text(day.toUpperCase(), startX, y + cellHeight/2 - 10, { width: dayColWidth });
             doc.font('Helvetica').fontSize(8).fillColor(colors.secondary)
                .text(format(date, 'MMM d'), startX, y + cellHeight/2 + 2, { width: dayColWidth });

             for (let p = 1; p <= 8; p++) {
               const x = startX + dayColWidth + ((p - 1) * periodColWidth);
               
               doc.rect(x, y, periodColWidth, cellHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
               
               if (isFri && p > 4) {
                 doc.rect(x + 0.5, y + 0.5, periodColWidth - 1, cellHeight - 1).fill(colors.mutedBg);
                 return;
               }

               const dateStr = format(date, 'yyyy-MM-dd');
               const dayExams = exams.filter(e => {
                 const examDateStr = format(new Date(e.date), 'yyyy-MM-dd');
                 return examDateStr === dateStr && e.period === p;
               });

               if (dayExams.length > 0) {
                 const numExams = dayExams.length;
                 dayExams.forEach((e, examIndex) => {
                   const margin = 2;
                   const totalHeight = cellHeight - (margin * 2);
                   const boxHeight = numExams > 1 ? (totalHeight / numExams) - 1 : totalHeight;
                   const boxWidth = periodColWidth - (margin * 2);
                   const yOffset = examIndex * (boxHeight + 1);
                   const classColor = classColorMap.get(e.classId) || classColorPalette[0];
                   
                   doc.roundedRect(x + margin, y + margin + yOffset, boxWidth, boxHeight, 3)
                      .fillAndStroke(classColor.bg, classColor.border);
                   
                   doc.fillColor(classColor.text);
                   
                   if (numExams === 1) {
                     doc.fontSize(7).font('Helvetica-Bold')
                        .text(e.subject.code, x + margin + 3, y + margin + 4, { width: boxWidth - 6, align: 'center' });
                     doc.fontSize(6).font('Helvetica')
                        .text(e.class.name, x + margin + 3, y + margin + 14, { width: boxWidth - 6, align: 'center' });
                     const gradeLevel = getGradeLevel(e.class.name);
                     const schedule = isFri ? BELL_SCHEDULES[gradeLevel].FRI : BELL_SCHEDULES[gradeLevel].MON_THU;
                     const timeRange = (schedule as any)[p] || "";
                     doc.fontSize(5)
                        .text(`${e.type} | ${timeRange}`, x + margin + 3, y + margin + 24, { width: boxWidth - 6, align: 'center' });
                     doc.text(e.creator.name, x + margin + 3, y + margin + 34, { width: boxWidth - 6, align: 'center' });
                   } else {
                     // Compact layout for multiple exams - include teacher name
                     doc.fontSize(6).font('Helvetica-Bold')
                        .text(e.subject.code, x + margin + 2, y + margin + yOffset + 2, { width: boxWidth - 4, align: 'center' });
                     doc.fontSize(5).font('Helvetica')
                        .text(`${e.class.name} - ${e.type}`, x + margin + 2, y + margin + yOffset + 9, { width: boxWidth - 4, align: 'center' });
                     doc.fontSize(4)
                        .text(e.creator.name, x + margin + 2, y + margin + yOffset + 15, { width: boxWidth - 4, align: 'center' });
                   }
                 });
               }
             }
           });
         }

         doc.end();
     } catch (err) {
         console.error(err);
         res.status(500).send("Error generating PDF");
     }
  });

  // === TEACHER PDF EXPORT ===
  app.get("/api/schedule/teacher-pdf", async (req, res) => {
     try {
         const weekStartStr = req.query.weekStart as string;
         const teacherId = req.query.teacherId ? Number(req.query.teacherId) : undefined;
         const weekStart = new Date(weekStartStr);
         const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
         
         if (!teacherId) {
           return res.status(400).send("Teacher ID required");
         }

         const teacher = await storage.getUser(teacherId);
         if (!teacher) {
           return res.status(404).send("Teacher not found");
         }
         
         const doc = new PDFDocument({ 
           layout: 'landscape', 
           size: 'A4',
           margins: { top: 30, left: 30, right: 30, bottom: 30 }
         });
         
         const scheduleWeekDate = format(weekStart, 'yyyy-MM-dd');
         res.setHeader('Content-Type', 'application/pdf');
         res.setHeader('Content-Disposition', `attachment; filename="${teacher.name} Schedule ${scheduleWeekDate}.pdf"`);
         doc.pipe(res);

         const colors = {
           primary: '#0f172a',
           secondary: '#64748b',
           border: '#e2e8f0',
           mutedBg: '#f8fafc'
         };

         const classColorPalette = [
           { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
           { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
           { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
           { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
           { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
           { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59' },
           { bg: '#fed7aa', border: '#f97316', text: '#9a3412' },
           { bg: '#f5d0fe', border: '#d946ef', text: '#86198f' },
           { bg: '#cffafe', border: '#06b6d4', text: '#155e75' },
           { bg: '#fecaca', border: '#ef4444', text: '#991b1b' },
         ];

         const allClasses = await storage.getAllClasses();
         const sortedClasses = [...allClasses].sort((a, b) => a.name.localeCompare(b.name));
         const classColorMap = new Map<number, typeof classColorPalette[0]>();
         sortedClasses.forEach((cls, index) => {
           classColorMap.set(cls.id, classColorPalette[index % classColorPalette.length]);
         });

         // Get all exams for this teacher in the week
         const allExams = await storage.getExams({ weekStart, weekEnd });
         const teacherExams = allExams.filter(e => e.createdByUserId === teacherId);

         const startX = 40;
         const startY = 130;
         const tableWidth = doc.page.width - 80;
         const dayColWidth = 100;
         const periodColWidth = (tableWidth - dayColWidth) / 8;
         const cellHeight = 70;
         const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

         // Header
         doc.font('Helvetica-Bold').fontSize(24).fillColor(colors.primary)
            .text(`${teacher.name}'s Schedule`, { align: 'center' });
         doc.fontSize(12).fillColor(colors.secondary)
            .text(`${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`, { align: 'center' });
         doc.moveDown(0.5).fontSize(11).fillColor(colors.primary)
            .text(`Total: ${teacherExams.filter(e => e.type === 'HOMEWORK').length} Homework, ${teacherExams.filter(e => e.type === 'QUIZ').length} Quizzes`, { align: 'center' });
         doc.moveDown(1);

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
           
           doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.primary)
              .text(day.toUpperCase(), startX, y + cellHeight/2 - 10, { width: dayColWidth });
           doc.font('Helvetica').fontSize(8).fillColor(colors.secondary)
              .text(format(date, 'MMM d'), startX, y + cellHeight/2 + 2, { width: dayColWidth });

           for (let p = 1; p <= 8; p++) {
             const x = startX + dayColWidth + ((p - 1) * periodColWidth);
             
             doc.rect(x, y, periodColWidth, cellHeight).strokeColor(colors.border).lineWidth(0.5).stroke();
             
             if (isFri && p > 4) {
               doc.rect(x + 0.5, y + 0.5, periodColWidth - 1, cellHeight - 1).fill(colors.mutedBg);
               return;
             }

             const dateStr = format(date, 'yyyy-MM-dd');
             const dayExams = teacherExams.filter(e => {
               const examDateStr = format(new Date(e.date), 'yyyy-MM-dd');
               return examDateStr === dateStr && e.period === p;
             });

             if (dayExams.length > 0) {
               const numExams = dayExams.length;
               dayExams.forEach((e, examIndex) => {
                 const margin = 2;
                 const totalHeight = cellHeight - (margin * 2);
                 const boxHeight = numExams > 1 ? (totalHeight / numExams) - 1 : totalHeight;
                 const boxWidth = periodColWidth - (margin * 2);
                 const yOffset = examIndex * (boxHeight + 1);
                 const classColor = classColorMap.get(e.classId) || classColorPalette[0];
                 
                 doc.roundedRect(x + margin, y + margin + yOffset, boxWidth, boxHeight, 3)
                    .fillAndStroke(classColor.bg, classColor.border);
                 
                 doc.fillColor(classColor.text);
                 
                 if (numExams === 1) {
                   doc.fontSize(7).font('Helvetica-Bold')
                      .text(e.subject.code, x + margin + 3, y + margin + 4, { width: boxWidth - 6, align: 'center' });
                   doc.fontSize(6).font('Helvetica')
                      .text(e.class.name, x + margin + 3, y + margin + 14, { width: boxWidth - 6, align: 'center' });
                   const gradeLevel = getGradeLevel(e.class.name);
                   const schedule = isFri ? BELL_SCHEDULES[gradeLevel].FRI : BELL_SCHEDULES[gradeLevel].MON_THU;
                   const timeRange = (schedule as any)[p] || "";
                   doc.fontSize(5)
                      .text(`${e.type} | ${timeRange}`, x + margin + 3, y + margin + 24, { width: boxWidth - 6, align: 'center' });
                   if (e.title) {
                     doc.text(e.title, x + margin + 3, y + margin + 34, { width: boxWidth - 6, align: 'center' });
                   }
                 } else {
                   doc.fontSize(6).font('Helvetica-Bold')
                      .text(e.subject.code, x + margin + 2, y + margin + yOffset + 2, { width: boxWidth - 4, align: 'center' });
                   doc.fontSize(5).font('Helvetica')
                      .text(`${e.class.name} - ${e.type}`, x + margin + 2, y + margin + yOffset + 9, { width: boxWidth - 4, align: 'center' });
                   if (e.title) {
                     doc.fontSize(4)
                        .text(e.title, x + margin + 2, y + margin + yOffset + 15, { width: boxWidth - 4, align: 'center' });
                   }
                 }
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

  // Teacher Analytics - shows breakdown per teacher
  app.get("/api/analytics/teachers", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any).role;
    if (!["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"].includes(role)) {
      return res.sendStatus(403);
    }
    try {
      const teacherAnalytics = await storage.getTeacherAnalytics();
      res.json(teacherAnalytics);
    } catch (error) {
      console.error("Teacher analytics error:", error);
      res.status(500).json({ message: "Failed to fetch teacher analytics" });
    }
  });

  // Weekly Staff Utilization - shows entries per teacher per week
  app.get("/api/analytics/weekly-utilization", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const role = (req.user as any).role;
    if (!["ADMIN", "PRINCIPAL", "VICE_PRINCIPAL"].includes(role)) {
      return res.sendStatus(403);
    }
    try {
      const weeklyUtilization = await storage.getWeeklyStaffUtilization();
      res.json(weeklyUtilization);
    } catch (error) {
      console.error("Weekly utilization error:", error);
      res.status(500).json({ message: "Failed to fetch weekly utilization" });
    }
  });

  // === INACTIVE ACCOUNTS (Admin only) ===
  app.get("/api/inactive-accounts", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied - Admin only" });
    }
    
    try {
      const inactiveAccounts = await storage.getInactiveAccounts();
      res.json(inactiveAccounts);
    } catch (error) {
      console.error("Inactive accounts error:", error);
      res.status(500).json({ message: "Failed to fetch inactive accounts" });
    }
  });
  
  app.post("/api/inactive-accounts/:id/deactivate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied - Admin only" });
    }
    
    try {
      const userId = parseInt(req.params.id);
      const updatedUser = await storage.markAccountInactive(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Mark inactive error:", error);
      res.status(500).json({ message: "Failed to mark account inactive" });
    }
  });

  // === DOCUMENTATION PDF GENERATION ===
  app.get("/api/documentation/:type", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied - Admin only" });
    }

    const type = req.params.type;
    const validTypes = ["admin", "teacher", "principal"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid manual type" });
    }

    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-manual.pdf"`);
      doc.pipe(res);

      // Helper functions
      const addHeader = (text: string, size = 24) => {
        doc.fontSize(size).font('Helvetica-Bold').fillColor('#1a1a2e').text(text);
        doc.moveDown(0.5);
      };

      const addSubHeader = (text: string) => {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#16213e').text(text);
        doc.moveDown(0.3);
      };

      const addParagraph = (text: string) => {
        doc.fontSize(11).font('Helvetica').fillColor('#333').text(text, { lineGap: 4 });
        doc.moveDown(0.5);
      };

      const addBullet = (text: string) => {
        doc.fontSize(11).font('Helvetica').fillColor('#333').text(`  •  ${text}`, { lineGap: 3 });
      };

      const addDivider = () => {
        doc.moveDown(0.5);
        doc.strokeColor('#e0e0e0').lineWidth(1)
          .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.8);
      };

      const addTip = (text: string) => {
        const y = doc.y;
        doc.rect(50, y, 495, 40).fill('#e8f4f8');
        doc.fillColor('#0077b6').fontSize(10).font('Helvetica-Bold')
          .text('💡 TIP', 60, y + 8);
        doc.fillColor('#333').fontSize(10).font('Helvetica')
          .text(text, 60, y + 22, { width: 475 });
        doc.y = y + 50;
      };

      // Cover Page
      doc.rect(0, 0, 595, 150).fill('#1a1a2e');
      doc.fillColor('#fff').fontSize(28).font('Helvetica-Bold')
        .text('Exam & Quiz Scheduler', 50, 60);
      doc.fontSize(18).font('Helvetica')
        .text(`${type.charAt(0).toUpperCase() + type.slice(1)} Manual`, 50, 100);
      doc.fillColor('#888').fontSize(10)
        .text('Asia/Dubai Timezone', 50, 130);
      doc.y = 180;
      doc.fillColor('#333');

      if (type === "admin") {
        // Admin Manual Content
        addHeader('Administrator Manual');
        addParagraph('Welcome to the Exam & Quiz Scheduler Administrator Manual. This comprehensive guide covers all administrative functions including user management, system configuration, and analytics.');
        
        addDivider();
        addSubHeader('1. Dashboard Overview');
        addParagraph('The Admin Dashboard provides a quick overview of today\'s scheduled exams, system status, and quick access to key functions.');
        addBullet('Today\'s Exams - Shows count and list of exams scheduled for today');
        addBullet('Quick Actions - Direct links to schedule view and common tasks');
        addBullet('Upcoming This Week - Preview of scheduled items for the week');
        
        doc.addPage();
        addSubHeader('2. User Management');
        addParagraph('Manage all staff accounts from the Manage Staff page. You can create, edit, and deactivate user accounts.');
        addBullet('Create new users with roles: Teacher, Coordinator, Principal, Vice Principal, Admin');
        addBullet('Edit user details including name, email, and role');
        addBullet('Reset passwords for users who have forgotten them');
        addBullet('Deactivate accounts when staff members leave');
        addTip('Use strong passwords for all accounts. Default password for bulk imports is "Staff123".');
        
        doc.addPage();
        addSubHeader('3. Bulk Import');
        addParagraph('Import large amounts of data using CSV files. Navigate to Administration > Bulk Import.');
        addBullet('Staff Import: name, username, email, role columns');
        addBullet('Subjects Import: code, name columns');
        addBullet('Classes Import: name column (format: A10[AMT]/1)');
        addTip('Download the template CSV files to ensure correct formatting.');
        
        addDivider();
        addSubHeader('4. Subject Management');
        addParagraph('Create and manage academic subjects that can be assigned to bookings.');
        addBullet('Each subject has a unique code and name');
        addBullet('Subjects are required when creating exam or homework bookings');
        
        addDivider();
        addSubHeader('5. Class Management');
        addParagraph('Define class sections following the naming convention: A[Grade][Program]/Section');
        addBullet('Example: A10AMT/1 = Grade 10, AMT program, Section 1');
        addBullet('Grade determines bell schedule (G9-10 vs G11-12)');
        
        doc.addPage();
        addSubHeader('6. Analytics & Reports');
        addParagraph('View comprehensive analytics on staff utilization and scheduling patterns.');
        addBullet('Weekly Staff Utilization - Track homework and quiz submissions by teacher');
        addBullet('Class Distribution - See scheduling load across classes');
        addBullet('Export reports for meetings and reviews');
        
        addDivider();
        addSubHeader('7. Inactive Accounts');
        addParagraph('Monitor accounts that haven\'t logged in since creation.');
        addBullet('10-day grace period for new accounts');
        addBullet('Deactivate inactive accounts to maintain security');
        addBullet('Admin accounts are exempt from inactivity tracking');
        
        addDivider();
        addSubHeader('8. Login Audit');
        addParagraph('Track all login activity across the system for security monitoring.');
        addBullet('View login history with timestamps');
        addBullet('Monitor for suspicious activity');

      } else if (type === "teacher") {
        // Teacher Manual Content
        addHeader('Teacher Manual');
        addParagraph('Welcome to the Exam & Quiz Scheduler Teacher Manual. This guide will help you schedule homework and quizzes, manage your bookings, and navigate the system effectively.');
        
        addDivider();
        addSubHeader('1. Getting Started');
        addParagraph('After logging in, you\'ll see your Dashboard showing today\'s scheduled items and upcoming exams for the week.');
        addBullet('Your dashboard shows only YOUR bookings');
        addBullet('Completed periods are marked as "Done" automatically');
        
        doc.addPage();
        addSubHeader('2. Viewing the Schedule');
        addParagraph('Navigate to Schedule to see the master schedule grid. You can view all classes or filter by specific class.');
        addBullet('Use week navigation to browse different weeks');
        addBullet('Click on any booking to see details');
        addBullet('Download PDF for offline reference');
        addTip('Use the class filter to focus on your assigned classes.');
        
        doc.addPage();
        addSubHeader('3. Creating a Booking');
        addParagraph('To schedule a quiz or homework assignment:');
        addBullet('1. Navigate to the Schedule page');
        addBullet('2. Click the "+" button on the desired period and day');
        addBullet('3. Select booking type: Quiz or Homework');
        addBullet('4. Choose the class, subject, and add a title');
        addBullet('5. Click Create to save the booking');
        addTip('Quiz limit: 1 per class per day. Homework: Unlimited per day.');
        
        addDivider();
        addSubHeader('4. Booking Rules');
        addParagraph('Important rules to remember when scheduling:');
        addBullet('Quiz: Maximum 1 quiz per class per day');
        addBullet('Homework: No daily limit');
        addBullet('Cannot book on weekends');
        addBullet('Friday has only 4 periods');
        addBullet('Monday-Thursday has 8 periods');
        
        doc.addPage();
        addSubHeader('5. Bell Schedules');
        addParagraph('Different grades follow different bell schedules:');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica-Bold').text('Grades 9-10 (Mon-Thu):');
        addBullet('Period 1: 07:30-08:20  |  Period 5: 11:20-12:10');
        addBullet('Period 2: 08:25-09:15  |  Period 6: 12:40-13:30');
        addBullet('Period 3: 09:30-10:20  |  Period 7: 13:35-14:25');
        addBullet('Period 4: 10:25-11:15  |  Period 8: 14:30-15:10');
        
        addDivider();
        addSubHeader('6. Managing Your Bookings');
        addParagraph('Access My Exams to see all your scheduled items.');
        addBullet('View your upcoming and past bookings');
        addBullet('Cancel bookings you no longer need');
        addBullet('Only you can cancel your own bookings');
        
        addDivider();
        addSubHeader('7. Exporting Schedules');
        addParagraph('Download PDF schedules for printing or sharing.');
        addBullet('Single class export: Filter by class and click Export PDF');
        addBullet('Multi-class export: Select multiple classes to include');
        addBullet('Each class gets a unique color for easy identification');

      } else if (type === "principal") {
        // Principal/VP Manual Content
        addHeader('Principal / Vice Principal Manual');
        addParagraph('Welcome to the Exam & Quiz Scheduler Leadership Manual. This guide covers oversight functions, analytics, and reporting features available to school leadership.');
        
        addDivider();
        addSubHeader('1. Dashboard Overview');
        addParagraph('Your dashboard provides a school-wide view of today\'s scheduled exams and upcoming items.');
        addBullet('See all exams scheduled across the school');
        addBullet('Completed periods are automatically marked as "Done"');
        addBullet('Quick access to reports and analytics');
        
        addDivider();
        addSubHeader('2. Master Schedule');
        addParagraph('View the complete school schedule from the Schedule page.');
        addBullet('See all classes and their scheduled items');
        addBullet('Filter by specific class or view all');
        addBullet('Navigate between weeks to plan ahead');
        addBullet('Export PDF schedules for distribution');
        addTip('Use the multi-export feature to create comprehensive schedule documents.');
        
        doc.addPage();
        addSubHeader('3. Teacher Overview');
        addParagraph('Monitor teacher activity and scheduling patterns.');
        addBullet('See which teachers are actively using the system');
        addBullet('View booking counts by teacher');
        addBullet('Identify teachers who may need support or training');
        
        addDivider();
        addSubHeader('4. Analytics Dashboard');
        addParagraph('Access detailed analytics for informed decision-making.');
        addBullet('Weekly Staff Utilization - Charts showing homework/quiz activity');
        addBullet('Filter by week to track trends over time');
        addBullet('View breakdown by teacher and booking type');
        addBullet('Use data for performance reviews and planning');
        
        doc.addPage();
        addSubHeader('5. Reports & Export');
        addParagraph('Generate reports for meetings and documentation.');
        addBullet('Export schedules as PDF with professional formatting');
        addBullet('Each class is color-coded for easy reference');
        addBullet('Share digital or printed copies with stakeholders');
        
        doc.addPage();
        addSubHeader('6. Understanding Booking Rules');
        addParagraph('Be aware of the scheduling constraints in place:');
        addBullet('Quiz Limit: Maximum 1 quiz per class per day');
        addBullet('Homework: Unlimited per day');
        addBullet('Period Limits: 8 periods Mon-Thu, 4 periods Friday');
        addBullet('Timezone: All times displayed in Asia/Dubai');
        
        addDivider();
        addSubHeader('7. User Roles Explained');
        addParagraph('Understanding the role hierarchy:');
        addBullet('Admin - Full system access including user management');
        addBullet('Principal - View all, access analytics and reports');
        addBullet('Vice Principal - Same as Principal');
        addBullet('Coordinator - Enhanced teacher with department oversight');
        addBullet('Teacher - Create and manage own bookings');
      }

      // Footer on last page
      doc.moveDown(2);
      doc.fontSize(9).fillColor('#888')
        .text('Exam & Quiz Scheduler - Academic Management System', { align: 'center' });
      doc.text('All times displayed in Asia/Dubai timezone', { align: 'center' });

      doc.end();
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
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

  // === LEARNING SUMMARIES ===
  app.get("/api/learning-summaries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const filters: { term?: string; weekNumber?: number } = {};
      if (req.query.term) filters.term = req.query.term as string;
      if (req.query.weekNumber) filters.weekNumber = Number(req.query.weekNumber);
      
      const summaries = await storage.getLearningSummaries(filters);
      res.json(summaries);
    } catch (err) {
      console.error("Get learning summaries error:", err);
      res.status(500).json({ message: "Failed to fetch learning summaries" });
    }
  });

  app.post("/api/learning-summaries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user as any;
      const data = { ...req.body };
      
      // Convert quizDate string to Date object if present
      if (data.quizDate && typeof data.quizDate === 'string') {
        data.quizDate = new Date(data.quizDate);
      }
      
      // Calculate week dates based on term and week number
      const { weekStartDate, weekEndDate } = getWeekDates(data.term, data.weekNumber);
      
      const summary = await storage.createLearningSummary({
        ...data,
        teacherId: user.id,
        status: "DRAFT",
        weekStartDate,
        weekEndDate
      });
      res.status(201).json(summary);
    } catch (err) {
      console.error("Create learning summary error:", err);
      res.status(500).json({ message: "Failed to create learning summary" });
    }
  });

  app.patch("/api/learning-summaries/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const existing = await storage.getLearningSummaryById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning summary not found" });
      }
      
      // Teachers can only edit their own drafts
      if (user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
        if (existing.teacherId !== user.id) {
          return res.status(403).json({ message: "You can only edit your own entries" });
        }
      }
      
      // If editing an approved entry, revert to pending approval
      let updateData = { ...req.body };
      
      // Convert quizDate string to Date object if present
      if (updateData.quizDate && typeof updateData.quizDate === 'string') {
        updateData.quizDate = new Date(updateData.quizDate);
      }
      
      if (existing.status === "APPROVED" && user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
        updateData.status = "PENDING_APPROVAL";
      }
      
      const summary = await storage.updateLearningSummary(id, updateData);
      res.json(summary);
    } catch (err) {
      console.error("Update learning summary error:", err);
      res.status(500).json({ message: "Failed to update learning summary" });
    }
  });

  app.delete("/api/learning-summaries/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const existing = await storage.getLearningSummaryById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning summary not found" });
      }
      
      // Only creator or admin can delete
      if (existing.teacherId !== user.id && user.role !== "ADMIN") {
        return res.status(403).json({ message: "You can only delete your own entries" });
      }
      
      await storage.deleteLearningSummary(id);
      res.sendStatus(200);
    } catch (err) {
      console.error("Delete learning summary error:", err);
      res.status(500).json({ message: "Failed to delete learning summary" });
    }
  });

  // Submit for approval
  app.post("/api/learning-summaries/:id/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = Number(req.params.id);
      const existing = await storage.getLearningSummaryById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning summary not found" });
      }
      
      const summary = await storage.updateLearningSummary(id, { status: "PENDING_APPROVAL" });
      res.json(summary);
    } catch (err) {
      console.error("Submit learning summary error:", err);
      res.status(500).json({ message: "Failed to submit for approval" });
    }
  });

  // Approve learning summary (Admin/VP only)
  app.post("/api/learning-summaries/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as any;
    if (user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
      return res.status(403).json({ message: "Only Admin or Vice Principal can approve" });
    }
    
    try {
      const id = Number(req.params.id);
      const existing = await storage.getLearningSummaryById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning summary not found" });
      }
      
      // Create exam in scheduler if quiz date is set
      let linkedExamId = existing.linkedExamId;
      if (existing.quizDate) {
        const dayOfWeek = getDay(new Date(existing.quizDate));
        const isFriday = dayOfWeek === 5;
        
        const examData = {
          title: `Quiz - ${existing.subject.code}`,
          type: "QUIZ" as const,
          date: new Date(existing.quizDate),
          period: 1,
          classId: existing.classId,
          subjectId: existing.subjectId,
          createdByUserId: existing.teacherId,
          status: "SCHEDULED" as const,
          notes: `Auto-created from Learning Summary. Topics: ${existing.upcomingTopics || 'N/A'}`
        };
        
        if (!linkedExamId) {
          const newExam = await storage.createExam(examData);
          linkedExamId = newExam.id;
        }
      }
      
      const summary = await storage.updateLearningSummary(id, { 
        status: "APPROVED",
        approvedById: user.id,
        approvalComments: req.body.comments || null,
        linkedExamId
      });
      res.json(summary);
    } catch (err) {
      console.error("Approve learning summary error:", err);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  // Reject learning summary (Admin/VP only)
  app.post("/api/learning-summaries/:id/reject", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as any;
    if (user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
      return res.status(403).json({ message: "Only Admin or Vice Principal can reject" });
    }
    
    try {
      const id = Number(req.params.id);
      const existing = await storage.getLearningSummaryById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning summary not found" });
      }
      
      // Remove from scheduler if previously approved
      if (existing.linkedExamId) {
        await storage.updateExam(existing.linkedExamId, { status: "CANCELLED" });
      }
      
      const summary = await storage.updateLearningSummary(id, { 
        status: "REJECTED",
        approvedById: user.id,
        approvalComments: req.body.comments || null,
        linkedExamId: null
      });
      res.json(summary);
    } catch (err) {
      console.error("Reject learning summary error:", err);
      res.status(500).json({ message: "Failed to reject" });
    }
  });

  // === EMAIL LEARNING SUMMARIES (Admin only) ===
  app.post("/api/learning-summaries/email", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as any;
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only administrators can send email reports" });
    }
    
    const { emails, term, weekNumber } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "At least one email address is required" });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((e: string) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ message: `Invalid email addresses: ${invalidEmails.join(', ')}` });
    }
    
    try {
      const summaries = await storage.getLearningSummaries({ term, weekNumber });
      const approvedSummaries = summaries.filter(s => s.status === "APPROVED");
      
      let htmlContent = `
        <h2>Learning Summaries Report</h2>
        <p><strong>${term?.replace('_', ' ')} - Week ${weekNumber}</strong></p>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
      `;
      
      if (approvedSummaries.length === 0) {
        htmlContent += '<p>No approved entries for this period.</p>';
      } else {
        htmlContent += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
        htmlContent += '<tr style="background-color: #f0f0f0;"><th>Grade</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Topics</th><th>Quiz Day</th><th>Quiz Period</th></tr>';
        
        for (const summary of approvedSummaries) {
          htmlContent += `<tr>
            <td>G${summary.grade}</td>
            <td>${summary.class?.name || 'Unknown'}</td>
            <td>${summary.subject?.code || ''} - ${summary.subject?.name || ''}</td>
            <td>${summary.teacher?.name || 'Unknown'}</td>
            <td>${summary.upcomingTopics || '-'}</td>
            <td>${summary.quizDay || '-'}</td>
            <td>${summary.quizTime ? `Period ${summary.quizTime}` : '-'}</td>
          </tr>`;
        }
        htmlContent += '</table>';
      }
      
      const { client: sgMail, fromEmail } = await getSendGridClient();
      
      const msg = {
        to: emails,
        from: fromEmail,
        subject: `Learning Summaries Report - ${term?.replace('_', ' ')} Week ${weekNumber}`,
        html: htmlContent,
      };
      
      await sgMail.send(msg);
      
      res.json({ message: `Report sent to ${emails.length} email(s)` });
    } catch (err: any) {
      console.error("Email summaries error:", err);
      res.status(500).json({ message: err.message || "Failed to send email" });
    }
  });

  // === LEARNING SUPPORT (SAPET) ===
  app.get("/api/learning-support", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const filters: { term?: string; weekNumber?: number } = {};
      if (req.query.term) filters.term = req.query.term as string;
      if (req.query.weekNumber) filters.weekNumber = Number(req.query.weekNumber);
      
      const support = await storage.getLearningSupport(filters);
      res.json(support);
    } catch (err) {
      console.error("Get learning support error:", err);
      res.status(500).json({ message: "Failed to fetch learning support" });
    }
  });

  app.post("/api/learning-support", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user as any;
      
      // Validate Teams link if provided
      if (req.body.teamsLink) {
        const urlRegex = /^https?:\/\/.+/i;
        if (!urlRegex.test(req.body.teamsLink)) {
          return res.status(400).json({ message: "Invalid Teams link URL" });
        }
      }
      
      // Calculate week dates based on term and week number
      const { weekStartDate, weekEndDate } = getWeekDates(req.body.term, req.body.weekNumber);
      
      // Convert sapetDate string to Date object if provided
      const supportData = {
        ...req.body,
        teacherId: user.id,
        status: "DRAFT",
        sapetDate: req.body.sapetDate ? new Date(req.body.sapetDate) : null,
        weekStartDate,
        weekEndDate
      };
      
      const support = await storage.createLearningSupport(supportData);
      res.status(201).json(support);
    } catch (err) {
      console.error("Create learning support error:", err);
      res.status(500).json({ message: "Failed to create learning support" });
    }
  });

  app.patch("/api/learning-support/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const existing = await storage.getLearningSupportById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning support not found" });
      }
      
      // Teachers can only edit their own entries
      if (user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
        if (existing.teacherId !== user.id) {
          return res.status(403).json({ message: "You can only edit your own entries" });
        }
      }
      
      // Validate Teams link if provided
      if (req.body.teamsLink) {
        const urlRegex = /^https?:\/\/.+/i;
        if (!urlRegex.test(req.body.teamsLink)) {
          return res.status(400).json({ message: "Invalid Teams link URL" });
        }
      }
      
      // If editing an approved entry, revert to pending approval
      let updateData = { ...req.body };
      if (existing.status === "APPROVED" && user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
        updateData.status = "PENDING_APPROVAL";
      }
      
      // Convert sapetDate string to Date object if provided
      if (updateData.sapetDate !== undefined) {
        updateData.sapetDate = updateData.sapetDate ? new Date(updateData.sapetDate) : null;
      }
      
      const support = await storage.updateLearningSupport(id, updateData);
      res.json(support);
    } catch (err) {
      console.error("Update learning support error:", err);
      res.status(500).json({ message: "Failed to update learning support" });
    }
  });

  app.delete("/api/learning-support/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = Number(req.params.id);
      const user = req.user as any;
      const existing = await storage.getLearningSupportById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning support not found" });
      }
      
      // Only creator or admin can delete
      if (existing.teacherId !== user.id && user.role !== "ADMIN") {
        return res.status(403).json({ message: "You can only delete your own entries" });
      }
      
      await storage.deleteLearningSupport(id);
      res.sendStatus(200);
    } catch (err) {
      console.error("Delete learning support error:", err);
      res.status(500).json({ message: "Failed to delete learning support" });
    }
  });

  // Submit for approval
  app.post("/api/learning-support/:id/submit", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = Number(req.params.id);
      const existing = await storage.getLearningSupportById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning support not found" });
      }
      
      const support = await storage.updateLearningSupport(id, { status: "PENDING_APPROVAL" });
      res.json(support);
    } catch (err) {
      console.error("Submit learning support error:", err);
      res.status(500).json({ message: "Failed to submit for approval" });
    }
  });

  // Approve learning support (Admin/VP only)
  app.post("/api/learning-support/:id/approve", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as any;
    if (user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
      return res.status(403).json({ message: "Only Admin or Vice Principal can approve" });
    }
    
    try {
      const id = Number(req.params.id);
      const existing = await storage.getLearningSupportById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning support not found" });
      }
      
      const support = await storage.updateLearningSupport(id, { 
        status: "APPROVED",
        approvedById: user.id,
        approvalComments: req.body.comments || null
      });
      res.json(support);
    } catch (err) {
      console.error("Approve learning support error:", err);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  // Reject learning support (Admin/VP only)
  app.post("/api/learning-support/:id/reject", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as any;
    if (user.role !== "ADMIN" && user.role !== "VICE_PRINCIPAL") {
      return res.status(403).json({ message: "Only Admin or Vice Principal can reject" });
    }
    
    try {
      const id = Number(req.params.id);
      const existing = await storage.getLearningSupportById(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Learning support not found" });
      }
      
      const support = await storage.updateLearningSupport(id, { 
        status: "REJECTED",
        approvedById: user.id,
        approvalComments: req.body.comments || null
      });
      res.json(support);
    } catch (err) {
      console.error("Reject learning support error:", err);
      res.status(500).json({ message: "Failed to reject" });
    }
  });

  // === EMAIL TIMETABLE (Admin only) ===
  app.post("/api/learning-support/email-timetable", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const user = req.user as any;
    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only administrators can send timetable emails" });
    }
    
    const { emails, term, weekNumber } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "At least one email address is required" });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((e: string) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ message: `Invalid email addresses: ${invalidEmails.join(', ')}` });
    }
    
    try {
      // Get approved learning support entries
      const support = await storage.getLearningSupport({ term, weekNumber });
      const approvedSupport = support.filter(s => s.status === "APPROVED");
      
      // Build email content
      const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      const supportByDay: Record<string, typeof support> = {};
      DAYS.forEach(day => { supportByDay[day] = []; });
      approvedSupport.forEach(s => {
        if (s.sapetDay && supportByDay[s.sapetDay]) {
          supportByDay[s.sapetDay].push(s);
        }
      });
      
      let htmlContent = `
        <h2>Learning Support (SAPET) Timetable</h2>
        <p><strong>${term?.replace('_', ' ')} - Week ${weekNumber}</strong></p>
        <p>Generated on: ${new Date().toLocaleDateString()}</p>
      `;
      
      if (approvedSupport.length === 0) {
        htmlContent += '<p>No approved sessions for this period.</p>';
      } else {
        htmlContent += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
        htmlContent += '<tr style="background-color: #f0f0f0;"><th>Day</th><th>Time</th><th>Class</th><th>Subject</th><th>Type</th><th>Teacher</th><th>Teams Link</th></tr>';
        
        for (const day of DAYS) {
          const sessions = supportByDay[day];
          if (sessions.length > 0) {
            for (const session of sessions) {
              htmlContent += `<tr>
                <td>${day}</td>
                <td>${session.sapetTime || 'TBD'}</td>
                <td>G${session.grade} - ${session.class?.name || 'Unknown'}</td>
                <td>${session.subject?.code || ''} - ${session.subject?.name || ''}</td>
                <td>${session.sessionType === 'online' ? 'Online' : session.sessionType === 'in_school' ? 'In School' : 'TBD'}</td>
                <td>${session.teacher?.name || 'Unknown'}</td>
                <td>${session.teamsLink ? `<a href="${session.teamsLink}">Join</a>` : '-'}</td>
              </tr>`;
            }
          }
        }
        htmlContent += '</table>';
      }
      
      const { client: sgMail, fromEmail } = await getSendGridClient();
      
      const msg = {
        to: emails,
        from: fromEmail,
        subject: `Learning Support Timetable - ${term?.replace('_', ' ')} Week ${weekNumber}`,
        html: htmlContent,
      };
      
      await sgMail.send(msg);
      
      res.json({ message: `Timetable sent to ${emails.length} email(s)` });
    } catch (err: any) {
      console.error("Email timetable error:", err);
      res.status(500).json({ message: err.message || "Failed to send email" });
    }
  });

  // === ACADEMIC PLANNING PDF EXPORTS ===
  app.get("/api/academic-planning/pdf/summaries", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const term = req.query.term as string;
      const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : undefined;
      
      const summaries = await storage.getLearningSummaries({ 
        term, 
        weekNumber 
      });
      
      // Only approved entries
      const approvedSummaries = summaries.filter(s => s.status === "APPROVED");
      
      const doc = new PDFDocument({ 
        layout: 'landscape',
        size: 'A4',
        margin: 40
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=learning-summaries-${term}-week${weekNumber}.pdf`);
      doc.pipe(res);
      
      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Learning Summaries', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`${term?.replace('_', ' ')} - Week ${weekNumber}`, { align: 'center' });
      doc.moveDown();
      
      if (approvedSummaries.length === 0) {
        doc.text('No approved entries for this period.', { align: 'center' });
      } else {
        // Table headers
        const headers = ['Grade', 'Class', 'Subject', 'Code', 'Teacher', 'Topics', 'Quiz Day', 'Quiz Date', 'Quiz Time'];
        const colWidths = [40, 60, 70, 50, 80, 150, 50, 70, 50];
        let y = doc.y;
        let x = 40;
        
        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((header, i) => {
          doc.text(header, x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i] + 5;
        });
        
        y += 15;
        doc.moveTo(40, y).lineTo(760, y).stroke();
        y += 5;
        
        // Table rows
        doc.font('Helvetica').fontSize(7);
        let alternate = false;
        
        for (const s of approvedSummaries) {
          if (y > 500) {
            doc.addPage();
            y = 40;
          }
          
          if (alternate) {
            doc.rect(40, y - 2, 720, 12).fill('#f5f5f5').stroke();
            doc.fillColor('black');
          }
          alternate = !alternate;
          
          x = 40;
          const row = [
            s.grade,
            s.class.name,
            s.subject.name,
            s.subject.code,
            s.teacher.name,
            s.upcomingTopics || '-',
            s.quizDay || '-',
            s.quizDate ? format(new Date(s.quizDate), 'MMM dd') : '-',
            s.quizTime || '-'
          ];
          
          row.forEach((cell, i) => {
            doc.text(String(cell).substring(0, 25), x, y, { width: colWidths[i], align: 'left' });
            x += colWidths[i] + 5;
          });
          y += 12;
        }
      }
      
      // Footer
      doc.fontSize(8).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 40, 550, { align: 'left' });
      
      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.get("/api/academic-planning/pdf/support", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const term = req.query.term as string;
      const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : undefined;
      
      const support = await storage.getLearningSupport({ 
        term, 
        weekNumber 
      });
      
      // Only approved entries
      const approvedSupport = support.filter(s => s.status === "APPROVED");
      
      const doc = new PDFDocument({ 
        layout: 'landscape',
        size: 'A4',
        margin: 40
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=learning-support-${term}-week${weekNumber}.pdf`);
      doc.pipe(res);
      
      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('Learning Support (SAPET Program)', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`${term?.replace('_', ' ')} - Week ${weekNumber}`, { align: 'center' });
      doc.moveDown();
      
      if (approvedSupport.length === 0) {
        doc.text('No approved entries for this period.', { align: 'center' });
      } else {
        // Table headers
        const headers = ['Grade', 'Code', 'Class', 'Teacher', 'Teams Link', 'SAPET Day', 'SAPET Date', 'SAPET Time'];
        const colWidths = [40, 50, 60, 80, 180, 60, 70, 60];
        let y = doc.y;
        let x = 40;
        
        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((header, i) => {
          doc.text(header, x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i] + 5;
        });
        
        y += 15;
        doc.moveTo(40, y).lineTo(760, y).stroke();
        y += 5;
        
        // Table rows
        doc.font('Helvetica').fontSize(7);
        let alternate = false;
        
        for (const s of approvedSupport) {
          if (y > 500) {
            doc.addPage();
            y = 40;
          }
          
          if (alternate) {
            doc.rect(40, y - 2, 720, 12).fill('#f5f5f5').stroke();
            doc.fillColor('black');
          }
          alternate = !alternate;
          
          x = 40;
          const row = [
            s.grade,
            s.subject.code,
            s.class.name,
            s.teacher.name,
            s.teamsLink ? s.teamsLink.substring(0, 30) + '...' : '-',
            s.sapetDay || '-',
            s.sapetDate ? format(new Date(s.sapetDate), 'MMM dd') : '-',
            s.sapetTime || '-'
          ];
          
          row.forEach((cell, i) => {
            doc.text(String(cell), x, y, { width: colWidths[i], align: 'left' });
            x += colWidths[i] + 5;
          });
          y += 12;
        }
      }
      
      // Footer
      doc.fontSize(8).text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 40, 550, { align: 'left' });
      
      doc.end();
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // SAPET Attendance routes
  app.get("/api/learning-support/:id/attendance", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const learningSupportId = Number(req.params.id);
      const support = await storage.getLearningSupportById(learningSupportId);
      
      if (!support) {
        return res.status(404).json({ message: "Learning support session not found" });
      }
      
      const attendance = await storage.getSapetAttendance(learningSupportId);
      res.json(attendance);
    } catch (err) {
      console.error("Error fetching attendance:", err);
      res.status(500).json({ message: "Failed to fetch attendance" });
    }
  });

  app.get("/api/learning-support/:id/students", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const learningSupportId = Number(req.params.id);
      const support = await storage.getLearningSupportById(learningSupportId);
      
      if (!support) {
        return res.status(404).json({ message: "Learning support session not found" });
      }
      
      const students = await storage.getStudentsByClass(support.classId);
      res.json(students);
    } catch (err) {
      console.error("Error fetching students:", err);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  app.post("/api/learning-support/:id/attendance", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const learningSupportId = Number(req.params.id);
      const user = req.user as any;
      const { attendance } = req.body;
      
      if (!Array.isArray(attendance)) {
        return res.status(400).json({ message: "Attendance must be an array" });
      }
      
      const support = await storage.getLearningSupportById(learningSupportId);
      
      if (!support) {
        return res.status(404).json({ message: "Learning support session not found" });
      }
      
      // Only the teacher who created the session or admin can mark attendance
      if (support.teacherId !== user.id && user.role !== "ADMIN") {
        return res.status(403).json({ message: "Only the session teacher or admin can mark attendance" });
      }
      
      const savedAttendance = await storage.saveSapetAttendance(learningSupportId, attendance, user.id);
      res.json(savedAttendance);
    } catch (err) {
      console.error("Error saving attendance:", err);
      res.status(500).json({ message: "Failed to save attendance" });
    }
  });

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
