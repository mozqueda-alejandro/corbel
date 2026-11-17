import { z } from "zod";

import { activityTypeSchema } from "~/schemas/activity-type.schema";
import { classSchema } from "~/schemas/class.schema";
import { dailySkillSchema } from "~/schemas/daily-skill.schema";
import { testVariantSchema } from "~/schemas/test-variant.schema";
import { userSchema } from "~/schemas/user.schema";

// A profile is the user's setup, not their work: sessions and students are deliberately not part of it, so a
// file that has them (such as an older export) is read without them.
export const profileSchema = z.object({
  class: z.array(classSchema).min(1, "At least one class is required"),
  user: userSchema,
  activities: z.array(activityTypeSchema).default([]),
  dailySkills: z.array(dailySkillSchema).default([]),
  testVariants: z.array(testVariantSchema).default([])
});

export type Profile = z.infer<typeof profileSchema>;
