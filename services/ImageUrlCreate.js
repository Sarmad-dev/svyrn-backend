export function getMimeTypeFromBase64(base64String) {
  const matches = base64String.match(/^data:(.+);base64,/);
  return matches ? matches[1] : null;
}

export function getFileCategory(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("application/")) return "document";
  return "unknown";
}
