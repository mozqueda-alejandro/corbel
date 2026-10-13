import { z } from "zod";

// New photos store their bytes as data + type: iOS WebKit can lose the backing file of a Blob kept in
// IndexedDB. Rows written before that change still carry a blob, so both shapes are valid.
export const photoSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  studentId: z.uuid(),
  data: z.instanceof(ArrayBuffer).optional(),
  type: z.string().optional(),
  blob: z.instanceof(Blob).optional(),
  createdAt: z.coerce.date()
});

export type Photo = z.infer<typeof photoSchema>;
