import { z } from "zod";

import { createBoundedStringSchema, getSessionDateBounds } from "./utils.ts";

export enum AttendanceStatusEnum {
  Present = "Present",
  Tardy = "Tardy",
  Absent = "Absent"
}
export enum SessionStatusEnum {
  Exported = "Exported",
  Drafting = "Drafting",
  Completed = "Completed"
}
const attendanceStatusSchema = z.enum(AttendanceStatusEnum);
const sessionStatusSchema = z.enum(SessionStatusEnum);

export const attendanceRecordSchema = z.object({
  studentId: z.uuid(),
  status: attendanceStatusSchema
});
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

export const sessionSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(2, 50),
  overview: createBoundedStringSchema(0, 200).optional(),
  status: sessionStatusSchema,
  date: z.date(),
  createdAt: z.date(),
  studentRoster: z.array(studentSchema),
  attendance: z.array(attendanceRecordSchema)
});

export const sessionCreateModalSchema = sessionSchema
  .pick({ name: true, date: true })
  .extend({
    date: z.date()
  })
  .refine(
    (data) => {
      const { minDate } = getSessionDateBounds();
      return data.date >= minDate;
    },
    { path: ["date"], error: "Session cannot be older than 1 year." }
  )
  .refine(
    (data) => {
      const { maxDate } = getSessionDateBounds();
      return data.date <= maxDate;
    },
    { path: ["date"], error: "Session cannot be planned further than 1 year." }
  );

export type Session = z.infer<typeof sessionSchema>;
export type SessionCreateModal = z.infer<typeof sessionCreateModalSchema>;
