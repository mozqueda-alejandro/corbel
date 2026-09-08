import { type CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { z } from "zod";

export function createBoundedStringSchema(min: number, max: number, allowSpecialChars = true) {
  if (min >= max) throw new Error("Min (" + min + ") should be less than Max (" + max + ").");
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("Schema Min/Max must be an integer.");

  const baseSchema = z.string()
    .trim()
    .min(min, { error: "Must be at least " + min + " characters." })
    .max(max, { error: "Cannot exceed " + max + " characters." });

  if (allowSpecialChars) {
    return baseSchema;
  }

  return baseSchema.regex(/^[a-zA-Z\s\-'.]+$/, { message: "Name can only contain letters, spaces, hyphens, apostrophes, and periods" });
}

export const nameSchema = createBoundedStringSchema(2, 30, false);

export function getSessionDateBounds() {
  const localTimeZone = getLocalTimeZone();
  const todayCalendarDate = today(localTimeZone);

  const minCalendarDate: CalendarDate = todayCalendarDate.subtract({ years: 1 });
  const maxCalendarDate: CalendarDate = todayCalendarDate.add({ years: 1 });

  return {
    minCalendarDate,
    maxCalendarDate,
    minDate: minCalendarDate.toDate(localTimeZone),
    maxDate: maxCalendarDate.toDate(localTimeZone)
  };
}
