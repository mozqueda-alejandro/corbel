import { z } from "zod";

import { nameSchema } from "./utils.ts";

export const userSchema = z.object({
  id: z.uuid(),
  firstName: nameSchema,
  lastName: nameSchema
});

export type User = z.infer<typeof userSchema>;
