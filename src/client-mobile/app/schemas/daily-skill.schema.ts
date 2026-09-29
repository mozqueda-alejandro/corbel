import { z } from "zod";

export const dailySkillSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1)
});

export type DailySkill = z.infer<typeof dailySkillSchema>;
