import { z } from "zod";

// Whether a skill is scored against a fixed standard (measured, answer-keyed) or by the evaluator's judgement.
export enum TestSkillCategoryEnum {
  Objective = "Objective",
  Subjective = "Subjective"
}

export const testSkillSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  category: z.enum(TestSkillCategoryEnum),
  criteria: z.string().min(1),
  maxScore: z.number().min(0)
});

export type TestSkill = z.infer<typeof testSkillSchema>;
