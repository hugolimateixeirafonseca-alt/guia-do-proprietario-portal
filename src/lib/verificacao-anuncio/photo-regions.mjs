const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normalizedRegionToPixels(region, imageWidth, imageHeight) {
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth < 1 || imageHeight < 1) {
    throw new TypeError("Dimensões de imagem inválidas.");
  }
  const left = clamp(Math.floor((region.x / 1000) * imageWidth), 0, imageWidth - 1);
  const top = clamp(Math.floor((region.y / 1000) * imageHeight), 0, imageHeight - 1);
  const right = clamp(Math.ceil(((region.x + region.largura) / 1000) * imageWidth), left + 1, imageWidth);
  const bottom = clamp(Math.ceil(((region.y + region.altura) / 1000) * imageHeight), top + 1, imageHeight);
  return { left, top, width: right - left, height: bottom - top };
}

export function createPhotoProcessor({ inspectImage, cropImage, fingerprintImage }) {
  return {
    async prepare({ images, regions }) {
      const prepared = [];
      for (const [index, region] of regions.entries()) {
        const source = images[region.fonte_imagem - 1];
        if (!source) continue;
        const dimensions = await inspectImage(source);
        const crop = normalizedRegionToPixels(region, dimensions.width, dimensions.height);
        const cropped = await cropImage(source, crop);
        const fingerprints = await fingerprintImage(cropped);
        prepared.push({
          id: `foto_${region.fonte_imagem}_${index + 1}`,
          sourceImage: region.fonte_imagem,
          crop,
          image: cropped,
          sha256: fingerprints.sha256,
          phash: fingerprints.phash,
          dhash: fingerprints.dhash
        });
      }
      return prepared;
    }
  };
}

