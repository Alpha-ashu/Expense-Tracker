import sharp from 'sharp';

const MAX_IMAGE_DIMENSION = Number(process.env.UPLOAD_IMAGE_MAX_DIMENSION || 2000);
const IMAGE_QUALITY = Number(process.env.UPLOAD_IMAGE_QUALITY || 82);

export const processImage = async (buffer: Buffer) => {
  const processed = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer();

  return {
    buffer: processed,
    contentType: 'image/webp',
    extension: 'webp',
    size: processed.length,
  };
};
