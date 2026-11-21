import type { Target } from "./formats";

/**
 * Encodes an RGBA ImageData into a standard 24-bit uncompressed Windows BMP file.
 */
export function encodeBMP(imageData: ImageData): Uint8Array {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Bitmap File Header (14 bytes)
  view.setUint16(0, 0x4d42, false); // "BM"
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true); // reserved
  view.setUint16(8, 0, true); // reserved
  view.setUint32(10, 54, true); // pixel data offset

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 24, true); // 24 bits per pixel (BGR)
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // horizontal resolution (72 DPI)
  view.setInt32(42, 2835, true); // vertical resolution (72 DPI)
  view.setUint32(46, 0, true); // colors in palette
  view.setUint32(50, 0, true); // important colors

  // Pixel data: bottom-to-top, BGR
  const bytes = new Uint8Array(buffer);
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    const rowStart = offset;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const r = data[srcIdx]!;
      const g = data[srcIdx + 1]!;
      const b = data[srcIdx + 2]!;
      const a = data[srcIdx + 3]!;
      // Blend with white if transparent
      const alpha = a / 255;
      const finalR = Math.round(r * alpha + 255 * (1 - alpha));
      const finalG = Math.round(g * alpha + 255 * (1 - alpha));
      const finalB = Math.round(b * alpha + 255 * (1 - alpha));

      bytes[offset++] = finalB;
      bytes[offset++] = finalG;
      bytes[offset++] = finalR;
    }
    // Row padding
    while ((offset - rowStart) % 4 !== 0) {
      bytes[offset++] = 0;
    }
  }

  return bytes;
}

/**
 * Encodes PNG bytes into an ICO (Windows Icon) file.
 * Modern OSes (Windows Vista+, macOS, Linux) support PNG-compressed icons.
 */
export function encodeICO(pngBytes: Uint8Array, width: number, height: number): Uint8Array {
  const icoSize = 6 + 16 + pngBytes.length;
  const buffer = new ArrayBuffer(icoSize);
  const view = new DataView(buffer);

  // ICONDIR (6 bytes)
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // 1 = ICO
  view.setUint16(4, 1, true); // 1 image

  // ICONDIRENTRY (16 bytes)
  const w = width >= 256 ? 0 : width;
  const h = height >= 256 ? 0 : height;
  view.setUint8(6, w);
  view.setUint8(7, h);
  view.setUint8(8, 0); // color count
  view.setUint8(9, 0); // reserved
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bpp
  view.setUint32(14, pngBytes.length, true); // bytes in resource
  view.setUint32(18, 22, true); // offset of resource

  const uint8 = new Uint8Array(buffer);
  uint8.set(pngBytes, 22);
  return uint8;
}

/**
 * Encodes an RGBA ImageData into a baseline uncompressed TIFF file.
 */
export function encodeTIFF(imageData: ImageData): Uint8Array {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const pixelCount = width * height;
  const imageByteCount = pixelCount * 4;

  const numEntries = 12;
  const ifdSize = 2 + numEntries * 12 + 4;
  const extraValuesSize = 8 + 8 + 8 + 8; // BitsPerSample(8), XRes(8), YRes(8)
  const headerAndIfdSize = 8 + ifdSize + extraValuesSize;
  const totalSize = headerAndIfdSize + imageByteCount;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Header
  view.setUint16(0, 0x4949, true); // Little endian "II"
  view.setUint16(2, 42, true); // Magic 42
  view.setUint32(4, 8, true); // First IFD at offset 8

  let ifdOffset = 8;
  view.setUint16(ifdOffset, numEntries, true);
  ifdOffset += 2;

  let extraOffset = 8 + ifdSize;
  const bitsPerSampleOffset = extraOffset;
  view.setUint16(bitsPerSampleOffset, 8, true);
  view.setUint16(bitsPerSampleOffset + 2, 8, true);
  view.setUint16(bitsPerSampleOffset + 4, 8, true);
  view.setUint16(bitsPerSampleOffset + 6, 8, true);
  extraOffset += 8;

  const xResOffset = extraOffset;
  view.setUint32(xResOffset, 72, true);
  view.setUint32(xResOffset + 4, 1, true);
  extraOffset += 8;

  const yResOffset = extraOffset;
  view.setUint32(yResOffset, 72, true);
  view.setUint32(yResOffset + 4, 1, true);
  extraOffset += 8;

  const pixelDataOffset = extraOffset;

  function writeTag(tag: number, type: number, count: number, valOrOffset: number) {
    view.setUint16(ifdOffset, tag, true);
    view.setUint16(ifdOffset + 2, type, true);
    view.setUint32(ifdOffset + 4, count, true);
    view.setUint32(ifdOffset + 8, valOrOffset, true);
    ifdOffset += 12;
  }

  writeTag(256, 4, 1, width); // ImageWidth
  writeTag(257, 4, 1, height); // ImageLength
  writeTag(258, 3, 4, bitsPerSampleOffset); // BitsPerSample
  writeTag(259, 3, 1, 1); // Compression (1 = none)
  writeTag(262, 3, 1, 2); // PhotometricInterpretation (2 = RGB)
  writeTag(273, 4, 1, pixelDataOffset); // StripOffsets
  writeTag(277, 3, 1, 4); // SamplesPerPixel (4 = RGBA)
  writeTag(278, 4, 1, height); // RowsPerStrip
  writeTag(279, 4, 1, imageByteCount); // StripByteCounts
  writeTag(282, 5, 1, xResOffset); // XResolution
  writeTag(283, 5, 1, yResOffset); // YResolution
  writeTag(284, 3, 1, 1); // PlanarConfiguration (1 = chunky)

  view.setUint32(ifdOffset, 0, true); // Next IFD offset

  // Copy RGBA pixels
  bytes.set(data, pixelDataOffset);

  return bytes;
}

/**
 * Decodes any image file to an HTMLCanvasElement.
 * Uses createImageBitmap with fallback to HTMLImageElement for SVG and edge cases.
 */
export async function decodeImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch {
    // Fallback using HTMLImageElement (e.g. for SVG blobs)
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`This browser could not decode "${file.name}".`));
      };
      img.src = url;
    });
  }
}

/**
 * Converts an image file to the requested target format using Canvas and custom encoders.
 */
export async function convertImage(
  file: File,
  targetExt: string,
  target: Target,
  settings: { quality: number }
): Promise<Blob> {
  const canvas = await decodeImageToCanvas(file);
  const ext = targetExt.toLowerCase();

  // 1. JPG / JPEG
  if (ext === "jpg" || ext === "jpeg") {
    const outCanvas = document.createElement("canvas");
    outCanvas.width = canvas.width;
    outCanvas.height = canvas.height;
    const ctx = outCanvas.getContext("2d")!;
    // JPG has no alpha channel: fill white background to avoid black borders
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      outCanvas.toBlob(resolve, "image/jpeg", settings.quality)
    );
    if (!blob || blob.type !== "image/jpeg") throw new Error("This browser failed to write JPG.");
    return blob;
  }

  // 2. PNG
  if (ext === "png") {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || blob.type !== "image/png") throw new Error("This browser failed to write PNG.");
    return blob;
  }

  // 3. WEBP
  if (ext === "webp") {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", settings.quality)
    );
    if (!blob || blob.type !== "image/webp") throw new Error("This browser failed to write WEBP.");
    return blob;
  }

  // 4. AVIF
  if (ext === "avif") {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/avif", settings.quality)
    );
    if (blob && blob.type === "image/avif") {
      return blob;
    }
    throw new Error("AVIF encoding not supported natively in this browser.");
  }

  // 5. BMP
  if (ext === "bmp") {
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bmpBytes = encodeBMP(imgData);
    return new Blob([bmpBytes.buffer as ArrayBuffer], { type: "image/bmp" });
  }

  // 6. ICO
  if (ext === "ico") {
    let icoCanvas = canvas;
    if (canvas.width > 256 || canvas.height > 256) {
      const scale = Math.min(256 / canvas.width, 256 / canvas.height);
      const w = Math.max(1, Math.round(canvas.width * scale));
      const h = Math.max(1, Math.round(canvas.height * scale));
      icoCanvas = document.createElement("canvas");
      icoCanvas.width = w;
      icoCanvas.height = h;
      const ctx = icoCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0, w, h);
    }
    const pngBlob = await new Promise<Blob | null>((resolve) => icoCanvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("Failed to encode PNG for ICO.");
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
    const icoBytes = encodeICO(pngBytes, icoCanvas.width, icoCanvas.height);
    return new Blob([icoBytes.buffer as ArrayBuffer], { type: "image/x-icon" });
  }

  // 7. TIFF
  if (ext === "tiff" || ext === "tif") {
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tiffBytes = encodeTIFF(imgData);
    return new Blob([tiffBytes.buffer as ArrayBuffer], { type: "image/tiff" });
  }

  // 8. GIF
  if (ext === "gif") {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/gif"));
    if (blob && blob.type === "image/gif") return blob;
    throw new Error("GIF encoding not supported natively in this browser.");
  }

  throw new Error(`Unsupported image target format: ${target.label}`);
}
