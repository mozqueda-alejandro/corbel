import { z } from "zod";

import { nameSchema } from "./utils.ts";

export enum AutoArchiveUnitEnum {
  Days = "Days",
  Months = "Months",
  Years = "Years"
}

export const userSettingsSchema = z.object({
  autoArchive: z.object({
    enabled: z.boolean(),
    amount: z.number()
      .int()
      .min(1)
      .max(999),
    unit: z.enum(AutoArchiveUnitEnum)
  }),
  // Tick feedback when a score slider changes value.
  feedback: z.object({
    haptics: z.boolean(),
    sound: z.boolean()
  })
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const defaultUserSettings: UserSettings = {
  autoArchive: { enabled: true, amount: 1, unit: AutoArchiveUnitEnum.Years },
  feedback: { haptics: true, sound: true }
};

export const userSchema = z.object({
  id: z.uuid(),
  firstName: nameSchema,
  lastName: nameSchema,
  settings: userSettingsSchema.optional()
});

export type User = z.infer<typeof userSchema>;
