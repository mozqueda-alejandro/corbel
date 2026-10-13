import type { Photo } from "~/schemas/photo.schema";

// Rebuilds a Blob from the stored bytes, falling back to the legacy blob column.
export function getPhotoBlob(photo: Pick<Photo, "data" | "type" | "blob">): Blob | undefined {
  if (photo.data) return new Blob([photo.data], { type: photo.type || "image/jpeg" });
  return photo.blob;
}
