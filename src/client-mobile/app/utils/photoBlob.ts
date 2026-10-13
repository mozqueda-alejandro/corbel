import type { Photo } from "~/schemas/photo.schema";

export function getPhotoBlob(photo: Pick<Photo, "data" | "type">): Blob {
  return new Blob([photo.data], { type: photo.type });
}
