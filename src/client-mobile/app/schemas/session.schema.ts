// ~/schemas/session.schema.ts
import { z } from "zod";

import { studentSchema } from "./student.schema";
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

export const dailySkillScoreSchema = z.object({
  skillId: z.uuid(),
  score: z.number().min(0)
});
export type DailySkillScore = z.infer<typeof dailySkillScoreSchema>;

export const testSkillScoreSchema = z.object({
  skillId: z.uuid(),
  score: z.number().min(0)
});
export type TestSkillScore = z.infer<typeof testSkillScoreSchema>;

export const sessionDailyRecordSchema = z.object({
  studentId: z.uuid(),
  activityId: z.uuid(),
  comments: createBoundedStringSchema(0, 200).optional(),
  recommendation: createBoundedStringSchema(0, 200).optional(),
  skills: z.array(dailySkillScoreSchema)
});
export type SessionDailyRecord = z.infer<typeof sessionDailyRecordSchema>;

export const sessionTestRecordSchema = z.object({
  studentId: z.uuid(),
  testVariantId: z.uuid(),
  skills: z.array(testSkillScoreSchema)
});
export type SessionTestRecord = z.infer<typeof sessionTestRecordSchema>;

export const sessionSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(2, 50),
  overview: createBoundedStringSchema(0, 200).optional(),
  status: sessionStatusSchema,
  date: z.coerce.date(),
  createdAt: z.coerce.date(),
  studentRoster: z.array(studentSchema),
  attendance: z.array(attendanceRecordSchema),
  dailies: z.array(sessionDailyRecordSchema),
  tests: z.array(sessionTestRecordSchema)
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
