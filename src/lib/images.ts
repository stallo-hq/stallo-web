/**
 * Shrinks a photo before upload so phone pictures (often 4–8 MB) become a few
 * hundred KB: faster on mobile data, and small enough for the AI to read.
 */
export async function shrinkImage(file: File, maxSide = 1280, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo (JPG or PNG).')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Couldn’t read that photo.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return await new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t read that photo.'))), 'image/jpeg', quality),
  )
}
