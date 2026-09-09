import { z } from "zod";

export enum NoteColor {
  Primary = "primary",
  Secondary = "secondary",
  Success = "success",
  Warning = "warning",
  Error = "error",
  Info = "info",
  Neutral = "neutral"
}

// 2. Generate the Zod schema automatically from the enum
export const noteColorEnum = z.enum(NoteColor);

export const noteSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  text: z.string().min(1, "Note text is required"),
  color: noteColorEnum,
  tags: z.array(z.string().min(1)),
  createdAt: z.date()
});
export type Note = z.infer<typeof noteSchema>;
