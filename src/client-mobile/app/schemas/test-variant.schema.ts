import { z } from "zod";

import { testSkillSchema } from "./test-skill.schema";
import { createBoundedStringSchema } from "./utils.ts";

export const testVariantSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(2, 80),
  skills: z.array(testSkillSchema).min(1)
});

export type TestVariant = z.infer<typeof testVariantSchema>;
