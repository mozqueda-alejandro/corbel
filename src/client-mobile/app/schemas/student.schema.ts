import { z } from "zod";

import { nameSchema } from "./utils.ts";

export const studentStatusEnum = z.enum(["Active", "Inactive", "Graduated"]);

export const studentSchema = z
  .object({
    id: z.uuid(),
    firstName: nameSchema.optional().default(""),
    lastName: nameSchema.optional().default(""),
    status: studentStatusEnum,
    year: z.number().min(0).max(10)
  });

export type Student = z.infer<typeof studentSchema>;
export type StudentStatus = z.infer<typeof studentStatusEnum>;
