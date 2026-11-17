import { z } from "zod";

import { testSkillSchema } from "./test-skill.schema";
import { createBoundedStringSchema } from "./utils.ts";

export const MAX_SPECIAL_SKILLS = 5;

export const testVariantSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(2, 80),
  skills: z.array(testSkillSchema).min(1),
  // How many special skills each student is scored on. Their names and criteria are written in per student.
  specialSkillCount: z.number().int().min(0)
    .max(MAX_SPECIAL_SKILLS)
    .default(1)
});

export type TestVariant = z.infer<typeof testVariantSchema>;
