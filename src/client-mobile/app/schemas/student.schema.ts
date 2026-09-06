import { z } from "zod";

import { createBoundedStringSchema } from "./utils.ts";

export const studentStatusEnum = z.enum(["Active", "Inactive", "Graduated"]);
export type StudentStatus = z.infer<typeof studentStatusEnum>;

const nameSchema = createBoundedStringSchema(2, 30)
  .regex(/^[a-zA-Z\s\-'.]+$/, { message: "Name can only contain letters, spaces, hyphens, apostrophes, and periods" });

export const studentSchema = z
  .object({
    id: z.uuid(),
    firstName: nameSchema.optional().default(""),
    lastName: nameSchema.optional().default(""),
    status: studentStatusEnum,
    year: z.number().min(0).max(10)
  });
export type Student = z.infer<typeof studentSchema>;
