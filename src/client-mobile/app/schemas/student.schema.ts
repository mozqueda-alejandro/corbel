import { z } from "zod";

import { nameSchema } from "./utils.ts";

export enum StudentStatusEnum {
  Active = "Active",
  Inactive = "Inactive",
  Graduated = "Graduated"
}

const studentStatusEnum = z.enum(StudentStatusEnum);

// Either name may be blank (the form only requires one of them). Blank is stored as "", so "" has to
// validate: a stored student is parsed again on every later save.
const optionalNameSchema = z.union([z.literal(""), nameSchema]).default("");

export const studentSchema = z.object({
  id: z.uuid(),
  firstName: optionalNameSchema,
  lastName: optionalNameSchema,
  preferredName: nameSchema.optional(),
  email: z.email().optional(),
  phoneNumber: z.e164().optional(),
  status: studentStatusEnum,
  year: z.number().min(0).max(10)
});

export type Student = z.infer<typeof studentSchema>;

// The part of a student a completed session keeps, so history still reads correctly after the student
// is edited, graduates or is deleted. Contact details are deliberately left out.
export const sessionStudentSchema = studentSchema.pick({
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  status: true
});
export type SessionStudent = z.infer<typeof sessionStudentSchema>;
