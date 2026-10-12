type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types: { description: string, accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle>
};

// Returns false if the user cancelled, so callers only treat a completed save as success.
export async function saveFile(
  fileName: string,
  fileBlob: Blob,
  fileType: { description: string, mimeType: string, extension: string }
): Promise<boolean> {
  const pickerWindow = window as SaveFilePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    try {
      const fileHandle = await pickerWindow.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: fileType.description, accept: { [fileType.mimeType]: [fileType.extension] } }]
      });
      const writableStream = await fileHandle.createWritable();
      await writableStream.write(fileBlob);
      await writableStream.close();
      return true;
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") return false;
      throw saveError;
    }
  }

  // Browsers without the File System Access API can't report cancellation, so a started download counts as saved.
  const downloadUrl = URL.createObjectURL(fileBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  return true;
}

export function saveJsonFile(fileName: string, data: unknown): Promise<boolean> {
  const fileBlob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  return saveFile(fileName, fileBlob, { description: "JSON file", mimeType: "application/json", extension: ".json" });
}
