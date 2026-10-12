import { z } from "zod";

export const photoSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  studentId: z.uuid(),
  blob: z.instanceof(Blob),
  createdAt: z.coerce.date()
});

export type Photo = z.infer<typeof photoSchema>;
