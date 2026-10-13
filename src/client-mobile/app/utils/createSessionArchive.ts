import type { Photo } from "~/schemas/photo.schema";
import type { Session } from "~/schemas/session.schema";

function getPhotoArchivePath(photoId: string) {
  return `photos/${photoId}.jpg`;
}

// Zips session.json with its photos. Each photo entry in the JSON points at its file in the archive.
export async function createSessionArchive(session: Session, photoList: Photo[]): Promise<Blob> {
  const { BlobReader, BlobWriter, TextReader, ZipWriter, configure } = await import("@zip.js/zip.js");
  configure({ useWebWorkers: false });

  const photoById = new Map(photoList.map(photo => [photo.id, photo]));
  const includedPhotoList = session.photos.filter(photo => photoById.has(photo.id));
  const sessionJson = {
    ...session,
    photos: includedPhotoList.map(photo => ({ ...photo, file: getPhotoArchivePath(photo.id) }))
  };

  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));
  await zipWriter.add("session.json", new TextReader(JSON.stringify(sessionJson, null, 2)));
  for (const photo of includedPhotoList) {
    // JPEGs are already compressed, so they are stored as-is.
    await zipWriter.add(getPhotoArchivePath(photo.id), new BlobReader(getPhotoBlob(photoById.get(photo.id)!)), { level: 0 });
  }
  return zipWriter.close();
}
