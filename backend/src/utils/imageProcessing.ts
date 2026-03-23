import sharp from 'sharp';

const MAX_IMAGE_DIMENSION = Number(process.env.UPLOAD_IMAGE_MAX_DIMENSION || 2400);

export const processImage = async (buffer: Buffer) => {
  // For receipt OCR: increase contrast + sharpness, convert to high-quality PNG
  // Grayscale removes colour noise that confuses the AI model (e.g. ₹ vs ¥)
  const processed = await sharp(buffer)
    .rotate()                     // auto-orient from EXIF
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .grayscale()                  // remove colour noise — helps distinguish similar symbols
    .normalise()                  // stretch contrast to full range for clearer text
    .sharpen({ sigma: 1.5 })      // sharpen edges for cleaner character recognition
    .png({ quality: 100, compressionLevel: 1 })  // lossless PNG — no compression artefacts
    .toBuffer();

  return {
    buffer: processed,
    contentType: 'image/png',
    extension: 'png',
    size: processed.length,
  };
};
