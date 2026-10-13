import { z } from "zod";

// Bytes are stored as data + type rather than a Blob: iOS WebKit can lose the backing file of a Blob kept in IndexedDB.
export const photoSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  studentId: z.uuid(),
  data: z.instanceof(ArrayBuffer),
  type: z.string(),
  createdAt: z.coerce.date()
});

export type Photo = z.infer<typeof photoSchema>;
