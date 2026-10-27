import { z } from "zod";

import { createBoundedStringSchema } from "./utils.ts";

export const activityNameSchema = createBoundedStringSchema(2, 60);

export const activityTypeSchema = z.object({
  id: z.uuid(),
  name: activityNameSchema
});

export type ActivityType = z.infer<typeof activityTypeSchema>;
