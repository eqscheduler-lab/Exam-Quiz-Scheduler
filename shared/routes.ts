import { z } from "zod";
import { insertUserSchema, insertSubjectSchema, insertStudentSchema, insertExamEventSchema, insertSettingsSchema, examEvents, subjects, users, students } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/login",
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.any(),
        401: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/logout",
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/user",
      responses: {
        200: z.any(),
        401: z.void(),
      },
    },
  },
  classes: {
    list: {
      method: "GET" as const,
      path: "/api/classes",
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/classes",
      input: z.object({ name: z.string() }),
      responses: {
        201: z.any(),
      },
    },
  },
  exams: {
    list: {
      method: "GET" as const,
      path: "/api/exams",
      input: z.object({
        weekStart: z.string().optional(),
        classId: z.coerce.number().optional(),
        teacherId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/exams",
      input: insertExamEventSchema.extend({
        date: z.coerce.date(),
      }),
      responses: {
        201: z.any(),
        400: z.object({ message: z.string() }),
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/exams/:id",
      input: insertExamEventSchema.partial().extend({
         date: z.coerce.date().optional(),
      }),
      responses: {
        200: z.any(),
        400: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  subjects: {
    list: {
      method: "GET" as const,
      path: "/api/subjects",
      responses: {
        200: z.array(z.any()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/subjects",
      input: insertSubjectSchema,
      responses: {
        201: z.any(),
      },
    },
  },
  students: {
    list: {
      method: "GET" as const,
      path: "/api/students",
      responses: {
        200: z.array(z.any()),
      },
    },
  },
  users: {
    list: {
      method: "GET" as const,
      path: "/api/users",
      responses: {
        200: z.array(z.any()),
      },
    },
  },
  schedule: {
    pdf: {
      method: "GET" as const,
      path: "/api/schedule/pdf",
      input: z.object({
        weekStart: z.string(),
        classId: z.coerce.number().optional(),
        classIds: z.string().optional(), // comma-separated list of class IDs
      }),
      responses: {
        200: z.any(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
