import { z } from "zod";

import { testSkillSchema } from "./test-skill.schema";

export const testVariantSchema = z.object({
  id: z.uuid(),
  skills: z.array(testSkillSchema).min(1)
});

export type TestVariant = z.infer<typeof testVariantSchema>;
