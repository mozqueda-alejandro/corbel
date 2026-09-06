import { z } from "zod";

export function createBoundedStringSchema(min: number, max: number) {
  if (min >= max) throw new Error("Min (" + min + ") should be less than Max (" + max + ").");
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("Schema Min/Max must be an integer.");

  return z.string()
    .trim()
    .min(min, { error: "Must be at least " + min + " characters." })
    .max(max, { error: "Cannot exceed " + max + " characters." });
}
