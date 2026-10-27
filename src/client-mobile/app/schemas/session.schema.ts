// ~/schemas/session.schema.ts
import { z } from "zod";

import { activityNameSchema } from "./activity-type.schema";
import { sessionStudentSchema } from "./student.schema";
import { testVariantSchema } from "./test-variant.schema";
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

// Saved as it is filled in, so any field may still be missing. Whether it counts as completed is worked
// out from its content (activity, recommendation and every daily skill present; comments are optional), not stored.
export const sessionDailyRecordSchema = z.object({
  studentId: z.uuid(),
  // The activity's name, kept on the record so it reads correctly whatever happens to the activity list.
  activity: activityNameSchema.optional(),
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
  // Stamped by the session repository on every save, so it is never set by callers.
  // The name is a snapshot of the user's name at the time, so history still reads correctly if they rename.
  lastModifiedAt: z.coerce.date().optional(),
  lastModifiedBy: z.string().optional(),
  exportedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  archivedAt: z.coerce.date().optional(),
  // Restarts the auto-archive clock so an unarchived session isn't immediately re-archived.
  unarchivedAt: z.coerce.date().optional(),
  // Set the first time the session is completed and never changed after, not even by reverting to draft.
  // Undefined means the session has never been completed and follows the live student list.
  studentRoster: z.array(sessionStudentSchema).optional(),
  // Copy of each test this session has scored, made when its first score is saved.
  // Every student scored on a test uses this same copy. Editing a test updates the copy while the session can
  // still change; once it is completed or archived the copy is frozen, and deleting the test never removes it.
  testVariants: z.array(testVariantSchema).optional(),
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
