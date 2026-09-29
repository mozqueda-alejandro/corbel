import { z } from "zod";

import { activityTypeSchema } from "~/schemas/activity-type.schema";
import { classSchema } from "~/schemas/class.schema";
import { dailySkillSchema } from "~/schemas/daily-skill.schema";
import { sessionSchema } from "~/schemas/session.schema";
import { studentSchema } from "~/schemas/student.schema";
import { testVariantSchema } from "~/schemas/test-variant.schema";
import { userSchema } from "~/schemas/user.schema";

function findDuplicateIdIndexList(itemList: { id: string }[]): number[] {
  const seenIdSet = new Set<string>();
  const duplicateIndexList: number[] = [];

  itemList.forEach((item, index) => {
    if (seenIdSet.has(item.id)) {
      duplicateIndexList.push(index);
    } else {
      seenIdSet.add(item.id);
    }
  });

  return duplicateIndexList;
}

export const onboardingImportSchema = z
  .object({
    class: z.array(classSchema).min(1, "At least one class is required"),
    user: userSchema,
    students: z.array(studentSchema).optional().default([]),
    activities: z.array(activityTypeSchema),
    dailySkills: z.array(dailySkillSchema),
    testVariants: z.array(testVariantSchema),
    sessions: z.array(sessionSchema).optional().default([])
  })
  .superRefine((data, context) => {
    const arrayFieldNameList = ["class", "students", "activities", "dailySkills", "testVariants", "sessions"] as const;

    for (const fieldName of arrayFieldNameList) {
      const duplicateIndexList = findDuplicateIdIndexList(data[fieldName]);
      for (const duplicateIndex of duplicateIndexList) {
        context.addIssue({
          code: "custom",
          path: [fieldName, duplicateIndex, "id"],
          message: "Duplicate id within import file"
        });
      }
    }

    data.testVariants.forEach((testVariant, testVariantIndex) => {
      const duplicateSkillIndexList = findDuplicateIdIndexList(testVariant.skills);
      for (const duplicateSkillIndex of duplicateSkillIndexList) {
        context.addIssue({
          code: "custom",
          path: ["testVariants", testVariantIndex, "skills", duplicateSkillIndex, "id"],
          message: "Duplicate id within test variant's skills"
        });
      }
    });

    data.sessions.forEach((session, sessionIndex) => {
      const duplicateRosterIndexList = findDuplicateIdIndexList(session.studentRoster);
      for (const duplicateIndex of duplicateRosterIndexList) {
        context.addIssue({
          code: "custom",
          path: ["sessions", sessionIndex, "studentRoster", duplicateIndex, "id"],
          message: "Duplicate student in session roster"
        });
      }
    });
  });

export type OnboardingImportData = z.infer<typeof onboardingImportSchema>;
