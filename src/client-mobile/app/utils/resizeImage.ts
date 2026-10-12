const MAX_LONG_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;

// Re-encodes any decodable image as a downscaled JPEG with its EXIF rotation applied.
// Throws if the browser can't decode the file (e.g. HEIC outside Safari).
export async function resizeImageToJpeg(imageFile: Blob): Promise<Blob> {
  const imageBitmap = await createImageBitmap(imageFile, { imageOrientation: "from-image" });

  try {
    const scale = Math.min(1, MAX_LONG_EDGE_PX / Math.max(imageBitmap.width, imageBitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imageBitmap.width * scale);
    canvas.height = Math.round(imageBitmap.height * scale);

    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) throw new Error("Canvas is not available.");
    canvasContext.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        jpegBlob => (jpegBlob ? resolve(jpegBlob) : reject(new Error("Couldn't encode the photo."))),
        "image/jpeg",
        JPEG_QUALITY
      );
    });
  } finally {
    imageBitmap.close();
  }
}
