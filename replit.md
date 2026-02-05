# Exam & Quiz Scheduler

## Overview

A full-stack web application for schools to schedule exams and quizzes across the academic year. The system supports role-based access control for teachers and administrators, enforces scheduling rules (like maximum 3 exams per class per day), and provides a visual weekly schedule grid with PDF export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled via Vite
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, with custom hooks for data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration and CSS variables for theming
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy, bcrypt for password hashing
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **PDF Generation**: PDFKit for server-side PDF export of schedules

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit manages database migrations in `./migrations`

### API Design
- **Pattern**: REST API with typed routes defined in `shared/routes.ts`
- **Validation**: Zod schemas for both request/response validation
- **Authentication**: Session-based auth with role checks on protected endpoints

### Key Business Rules
1. **Period Scheduling**: Monday-Thursday has 8 periods (50 min each); Friday has 4 periods
2. **Booking Limits**: 
   - Quiz: Maximum 1 per class per day
   - Homework: Unlimited per day
3. **Role Permissions**:
   - Teachers: Create/manage their own exams, view schedules, cancel own bookings
   - Lead Teachers: All Teacher permissions PLUS department-specific approval authority (can only approve/reject entries from teachers within their assigned department)
   - Coordinators: View schedules, access learning summaries and SAPET analytics
   - Vice Principals: Approve/reject learning summaries and SAPET sessions, view all analytics, manage teacher entries
   - Principals: Same as Vice Principal with full oversight
   - Admins: Full access including user/subject/student management, bulk import, factory reset

### Department System
Staff can be assigned to one of 10 departments:
- SCIENCE, MATHEMATICS, ENGLISH, ARABIC, SOCIAL_STUDIES, PHYSICAL_EDUCATION, ARTS, TECHNOLOGY, ISLAMIC_STUDIES, FRENCH

**Department Management Page** (`/admin/departments`):
- Overview statistics: Total departments, assigned staff count, unassigned staff count
- Expandable accordion for each department showing members
- Unassigned staff list with guidance to assign via Staff Management

**Lead Teacher Department Authority**:
- Lead Teachers can only approve/reject entries from teachers in their same department
- Approval is denied if either Lead Teacher or teacher has no department assigned (null check enforced)

### PDF Export Feature
The Schedule page (`/schedule`) offers two export options:
- **Single Export**: Exports the current view (all classes or filtered single class)
- **Multi-Export**: Opens a dialog to select multiple classes at once for combined PDF export
  - "Select All" to quickly select all classes
  - "Clear" to deselect all classes
  - Individual checkboxes for each class
  - Downloaded PDF shows all selected classes with unique color coding

### Bulk Import Feature
Admins can bulk import data using CSV files with downloadable templates:
- **Staff Import** (`/admin/bulk-import`): Import teachers/coordinators/admins with columns: name, username, email, role. Default password: "Staff123"
- **Subjects Import**: Import subjects with columns: code, name
- **Classes Import**: Import classes with column: name (format: A[Grade][Program]/Section)
- **Students Import**: Import students with columns: student_id, name, class_name. Class name must match an existing class.

### Academic Planning Hub (`/academic-planning`)
The Academic Planning Hub allows teachers and administrators to manage learning summaries and learning support schedules. Features include:

**Learning Summaries**
- Weekly planning entries with upcoming topics and optional quiz scheduling
- Term and week selectors (3 terms, 15 weeks each)
- When confirmed, automatically creates quiz exam events in the scheduler
- PDF export for weekly reports (confirmed entries only)

**Learning Support (SAPET Program)**
- Session scheduling with Teams meeting links (URL validated)
- SAPET day/date/time fields for session planning
- PDF export for weekly reports (confirmed entries only)

**Booking Confirmation Workflow**
- Statuses: DRAFT → APPROVED (auto-confirmed on submit)
- Teachers create entries in DRAFT status
- Clicking "Confirm booking" (green checkmark) automatically confirms the entry
- Email notification sent to teacher upon confirmation via SendGrid
- Quiz events automatically created in scheduler for Learning Summaries with quiz details
- No manual approval required - entries are instantly confirmed

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components including shadcn/ui
    hooks/        # Custom React hooks for data fetching
    pages/        # Route page components
    lib/          # Utilities and query client
server/           # Express backend
  auth.ts         # Passport authentication setup
  db.ts           # Database connection
  routes.ts       # API route handlers
  storage.ts      # Data access layer
shared/           # Shared between client/server
  schema.ts       # Drizzle database schemas
  routes.ts       # API route definitions with Zod schemas
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Session Storage**: PostgreSQL table `session` for express-session

### Third-Party Libraries
- **Drizzle ORM**: Database queries and schema management
- **PDFKit**: Server-side PDF generation for schedule exports
- **date-fns**: Date manipulation for calendar/schedule features
- **bcryptjs**: Password hashing for authentication

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (optional, has default)