// import { z } from "zod";
//
// const nameSchema = z
//   .string("Name must be a string")
//   .trim()
//   .min(2, { message: "Name must be at least 2 characters long" })
//   .max(50, { message: "Name cannot exceed 50 characters" })
//   .regex(/^[a-zA-Z\s\-'.]+$/, {
//     message: "Name can only contain letters, spaces, hyphens, apostrophes, and periods"
//   });
//
// const StudentStatusSchema = z.enum(["active", "inactive", "graduated"]);
// const StudentSchema = z.object({
//   id: z.uuidv7(),
//   first_name: nameSchema,
//   last_name: nameSchema,
//   status: StudentStatusSchema,
//   year: z.number().min(0).max(8)
// });
//
// type StudentStatus = z.infer<typeof StudentStatusSchema>;
// type Student = z.infer<typeof StudentSchema>;
//
// const ActivitySchema = z.object({
//   id: z.number(),
//   name: z.string()
// });
// type Activity = z.infer<typeof ActivitySchema>;
//
// // Daily Skills (read-only)
//
// const DailySkillSchema = z.object({
//   id: z.number(),
//   name: z.string()
// });
// type DailySkill = z.infer<typeof DailySkillSchema>;
//
// // Test Variants (read-only)
//
// const TestSkillSchema = z.object({
//   id: z.number(),
//   name: z.string(),
//   criteria: z.string(),
//   max_score: z.number()
// });
// const TestVariantSchema = z.object({
//   id: z.number(),
//   skills: z.array(TestSkillSchema)
// });
// type TestSkill = z.infer<typeof TestSkillSchema>;
// type TestVariant = z.infer<typeof TestVariantSchema>;
//
// export {
//   StudentStatusSchema,
//   StudentSchema,
//   ActivitySchema,
//   DailySkillSchema,
//   TestSkillSchema,
//   TestVariantSchema
// };
//
// export type {
//   StudentStatus,
//   Student,
//   Activity,
//   DailySkill,
//   TestSkill,
//   TestVariant
// };


