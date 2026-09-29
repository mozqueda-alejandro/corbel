import { z } from "zod";

export const activityTypeSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1)
});

export type ActivityType = z.infer<typeof activityTypeSchema>;
