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
  Completed = "Completed",
  Archived = "Archived"
}
const attendanceStatusSchema = z.enum(AttendanceStatusEnum);
const sessionStatusSchema = z.enum(SessionStatusEnum);

export const attendanceRecordSchema = z.object({
  studentId: z.uuid(),
  status: attendanceStatusSchema
});
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

export const DAILY_SKILL_SCORE_MIN = 1;
export const DAILY_SKILL_SCORE_MAX = 5;

export const dailySkillScoreSchema = z.object({
  skillId: z.uuid(),
  score: z.number().int().min(DAILY_SKILL_SCORE_MIN)
    .max(DAILY_SKILL_SCORE_MAX)
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
  skills: z.array(dailySkillScoreSchema),
  // Missing means the record is saved but not yet submitted.
  submittedAt: z.coerce.date().optional()
});
export type SessionDailyRecord = z.infer<typeof sessionDailyRecordSchema>;

export const sessionDailyFormSchema = sessionDailyRecordSchema
  .omit({ submittedAt: true })
  .extend({
    studentId: z.uuid("Select a student."),
    activityId: z.uuid("Select an activity.")
  });
export type SessionDailyForm = z.infer<typeof sessionDailyFormSchema>;

export const sessionTestRecordSchema = z.object({
  studentId: z.uuid(),
  testVariantId: z.uuid(),
  skills: z.array(testSkillScoreSchema)
});
export type SessionTestRecord = z.infer<typeof sessionTestRecordSchema>;

export const MAX_PHOTOS_PER_STUDENT = 10;
export const MAX_TAGS_PER_PHOTO = 10;

// The image bytes live in photoTable; this is only the reference.
export const sessionPhotoSchema = z.object({
  id: z.uuid(),
  studentId: z.uuid(),
  createdAt: z.coerce.date(),
  // Free-form per photo; the UI suggests skill names but nothing ties a tag to a skill.
  tags: z.array(z.string().trim().min(1)
    .max(50)).max(MAX_TAGS_PER_PHOTO)
    .default([])
});
export type SessionPhoto = z.infer<typeof sessionPhotoSchema>;

export const sessionSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(2, 50),
  overview: createBoundedStringSchema(0, 200).optional(),
  status: sessionStatusSchema,
  date: z.coerce.date(),
  createdAt: z.coerce.date(),
  exportedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  archivedAt: z.coerce.date().optional(),
  // Restarts the auto-archive clock so an unarchived session isn't immediately re-archived.
  unarchivedAt: z.coerce.date().optional(),
  studentRoster: z.array(studentSchema),
  attendance: z.array(attendanceRecordSchema),
  dailies: z.array(sessionDailyRecordSchema),
  tests: z.array(sessionTestRecordSchema),
  // Refined on the field rather than the object so sessionSchema can still be picked from.
  photos: z.array(sessionPhotoSchema)
    .default([])
    .refine(
      (photoList) => {
        const photoCountByStudentId = new Map<string, number>();
        for (const photo of photoList) {
          photoCountByStudentId.set(photo.studentId, (photoCountByStudentId.get(photo.studentId) ?? 0) + 1);
        }
        return [...photoCountByStudentId.values()].every(photoCount => photoCount <= MAX_PHOTOS_PER_STUDENT);
      },
      { error: `A student can have at most ${MAX_PHOTOS_PER_STUDENT} photos per session.` }
    )
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
