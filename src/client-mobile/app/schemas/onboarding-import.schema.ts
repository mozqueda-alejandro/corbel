import { z } from "zod";

import { classSchema } from "~/schemas/class.schema";
import { userSchema } from "~/schemas/user.schema";

export const onboardingImportSchema = z.object({
  class: z.array(classSchema).min(1, "At least one class is required"),
  user: userSchema
}).passthrough();
export type OnboardingImportData = z.infer<typeof onboardingImportSchema>;
