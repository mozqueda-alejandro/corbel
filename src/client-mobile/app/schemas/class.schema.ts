import { z } from "zod";

import { createBoundedStringSchema } from "./utils.ts";

export const classSchema = z.object({
  id: z.uuid(),
  name: createBoundedStringSchema(1, 30),
  startDate: z.date(),
  endDate: z.date()
}).refine(dataValue => dataValue.endDate >= dataValue.startDate, {
  message: "End date must be on or after start date",
  path: ["endDate"]
});

export type Class = z.infer<typeof classSchema>;
