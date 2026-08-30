import {
  INTERNAL_DUPLICATE_PHASH_DISTANCE,
  INTERNAL_REVIEW_PHASH_DISTANCE
} from "./constants.mjs";

const toBits = (hex) => BigInt(`0x${hex}`);

export function hammingDistance64(first, second) {
  let value = toBits(first) ^ toBits(second);
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

const bitsToHex = (bits) => {
  let value = 0n;
  for (const bit of bits) value = (value << 1n) | BigInt(bit ? 1 : 0);
  return value.toString(16).padStart(16, "0");
};

export function computeDHash(grayscale, width, height) {
  if (width !== 9 || height !== 8 || grayscale.length !== 72) {
    throw new TypeError("dHash requer uma matriz grayscale de 9x8.");
  }
  const bits = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      bits.push(grayscale[y * width + x] > grayscale[y * width + x + 1]);
    }
  }
  return bitsToHex(bits);
}

export function computePHash(grayscale, width = 32, height = 32) {
  if (width !== 32 || height !== 32 || grayscale.length !== 1024) {
    throw new TypeError("pHash requer uma matriz grayscale de 32x32.");
  }
  const coefficients = [];
  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) {
      let sum = 0;
      for (let y = 0; y < 32; y += 1) {
        for (let x = 0; x < 32; x += 1) {
          sum += grayscale[y * 32 + x]
            * Math.cos(((2 * x + 1) * u * Math.PI) / 64)
            * Math.cos(((2 * y + 1) * v * Math.PI) / 64);
        }
      }
      coefficients.push(sum);
    }
  }
  const comparable = coefficients.slice(1).sort((a, b) => a - b);
  const median = comparable[Math.floor(comparable.length / 2)];
  return bitsToHex(coefficients.map((coefficient, index) => index === 0 ? false : coefficient > median));
}

export function comparePerceptualHashes(first, second) {
  const phashDistance = hammingDistance64(first.phash, second.phash);
  const dhashDistance = hammingDistance64(first.dhash, second.dhash);
  if (phashDistance <= INTERNAL_DUPLICATE_PHASH_DISTANCE) {
    return { decision: "duplicate", phashDistance, dhashDistance };
  }
  if (phashDistance <= INTERNAL_REVIEW_PHASH_DISTANCE && dhashDistance <= INTERNAL_DUPLICATE_PHASH_DISTANCE) {
    return { decision: "duplicate", phashDistance, dhashDistance };
  }
  if (phashDistance <= INTERNAL_REVIEW_PHASH_DISTANCE) {
    return { decision: "review", phashDistance, dhashDistance };
  }
  return { decision: "distinct", phashDistance, dhashDistance };
}

export function deduplicatePhotos(photos) {
  const unique = [];
  const duplicates = [];
  for (const photo of photos) {
    const exact = unique.find((candidate) => candidate.sha256 === photo.sha256);
    if (exact) {
      duplicates.push({ photoId: photo.id, duplicateOf: exact.id, reason: "sha256" });
      continue;
    }
    const perceptual = unique
      .map((candidate) => ({ candidate, comparison: comparePerceptualHashes(candidate, photo) }))
      .find(({ comparison }) => comparison.decision === "duplicate");
    if (perceptual) {
      duplicates.push({ photoId: photo.id, duplicateOf: perceptual.candidate.id, reason: "perceptual" });
      continue;
    }
    unique.push(photo);
  }
  return { unique, duplicates };
}

