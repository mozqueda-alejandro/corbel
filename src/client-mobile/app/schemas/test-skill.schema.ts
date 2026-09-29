import { z } from "zod";

export const testSkillSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  criteria: z.string().min(1),
  maxScore: z.number().min(0)
});

export type TestSkill = z.infer<typeof testSkillSchema>;
