import { z } from "zod";

import { createBoundedStringSchema } from "./utils.ts";

export const studentAttendanceEnum = z.enum(["Present", "Tardy", "Absent"]);

export const sessionSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(2, 50),
  date: z.date(),
  studentRoster: z.array(studentSchema),
  studentAttendance: z.map(z.uuid(), studentAttendanceEnum)
});

export const sessionCreateModalSchema = sessionSchema
  .pick({
    name: true,
    date: true
  })
  .extend({
    date: z
      .date()
      .min(new Date().setFullYear(new Date().getFullYear() - 1), { error: "Session cannot be older than 1 year." })
      .max(new Date().setFullYear(new Date().getFullYear() + 1), { error: "Session cannot be planned further than 1 year." })
  });

export type Session = z.infer<typeof sessionSchema>;
export type SessionCreateModal = z.infer<typeof sessionCreateModalSchema>;
