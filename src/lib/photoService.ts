import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Compresses an image file using an HTML Canvas to a max size and specified JPEG quality.
 * Returns both the compressed Base64 data URL and a binary Blob (for Storage upload).
 */
export function compressPhoto(
  file: File,
  maxDim: number = 300,
  quality: number = 0.7
): Promise<{ base64: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale proportionally
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
          }

          // Render image
          ctx.drawImage(img, 0, 0, width, height);

          // Get Compressed Base64 data URL
          const base64 = canvas.toDataURL('image/jpeg', quality);

          // Convert to Blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ base64, blob });
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(new Error('Failed to load image: ' + err));
    };
    reader.onerror = (err) => reject(new Error('Failed to read file: ' + err));
    reader.readAsDataURL(file);
  });
}

export interface SmartCompressedImage {
  base64: string;
  blob: Blob;
  contentType: string;
  extension: 'jpg' | 'png' | 'svg';
}

/**
 * Compresses an image smartly: preserves transparency (PNG/SVG) when preserveAlpha is true,
 * and uses compact JPEG otherwise.
 */
export function compressImageSmart(
  file: File,
  options: { maxDim?: number; quality?: number; preserveAlpha?: boolean } = {}
): Promise<SmartCompressedImage> {
  const { maxDim = 1200, quality = 0.8, preserveAlpha = false } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      if (file.type === 'image/svg+xml' && preserveAlpha) {
        resolve({
          base64: dataUrl,
          blob: file,
          contentType: 'image/svg+xml',
          extension: 'svg',
        });
        return;
      }

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width || maxDim;
          let height = img.height || maxDim;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
          }

          const keepPng =
            preserveAlpha && (file.type === 'image/png' || file.type === 'image/webp');
          const mime = keepPng ? 'image/png' : 'image/jpeg';
          const ext: 'png' | 'jpg' = keepPng ? 'png' : 'jpg';

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const base64 = keepPng
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', quality);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ base64, blob, contentType: mime, extension: ext });
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            mime,
            keepPng ? undefined : quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(new Error('Failed to load image: ' + err));
    };
    reader.onerror = (err) => reject(new Error('Failed to read file: ' + err));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a file or blob to Firebase Storage at the specified path with a timeout guard.
 */
export async function uploadPhotoToStorage(
  blob: Blob | File,
  storagePath: string,
  contentType: string = 'image/jpeg',
  timeoutMs: number = 15000
): Promise<string> {
  if (!storage || !storage.app?.options?.storageBucket) {
    throw new Error('Firebase Storage is not initialized or missing bucket');
  }
  const storageRef = ref(storage, storagePath);

  const uploadTask = async () => {
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: blob.type || contentType,
      cacheControl: 'public,max-age=31536000',
    });
    return await getDownloadURL(snapshot.ref);
  };

  if (timeoutMs > 0) {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        uploadTask(),
        new Promise<string>((_, reject) => {
          timerId = setTimeout(
            () => reject(new Error('Firebase Storage upload timed out')),
            timeoutMs
          );
        }),
      ]);
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }

  return await uploadTask();
}

/**
 * Compresses an image file and uploads it to Firebase Storage.
 * Falls back to compact Base64 only if Storage upload fails.
 */
export async function uploadImageAsset(
  file: File,
  storagePathWithoutExt: string,
  options: {
    maxDim?: number;
    quality?: number;
    preserveAlpha?: boolean;
    fallbackMaxDim?: number;
    fallbackQuality?: number;
    timeoutMs?: number;
  } = {}
): Promise<{ url: string; storedInCloud: boolean; error?: string }> {
  const {
    maxDim = 1200,
    quality = 0.8,
    preserveAlpha = false,
    fallbackMaxDim = 750,
    fallbackQuality = 0.62,
    timeoutMs = 15000,
  } = options;

  const compressed = await compressImageSmart(file, {
    maxDim,
    quality,
    preserveAlpha,
  });

  const cleanPrefix = storagePathWithoutExt.replace(/\.(jpe?g|png|webp|svg)$/i, '');
  const fullPath = `${cleanPrefix}.${compressed.extension}`;

  try {
    const downloadUrl = await uploadPhotoToStorage(
      compressed.blob,
      fullPath,
      compressed.contentType,
      timeoutMs
    );
    return { url: downloadUrl, storedInCloud: true };
  } catch (err: any) {
    console.warn(`[Storage] Upload to "${fullPath}" failed, using compact fallback:`, err?.message || err);
    let fallbackUrl = compressed.base64;
    if (fallbackUrl.length > 180000 && compressed.extension !== 'svg') {
      try {
        const tighter = await compressImageSmart(file, {
          maxDim: fallbackMaxDim,
          quality: fallbackQuality,
          preserveAlpha: preserveAlpha && compressed.extension === 'png',
        });
        fallbackUrl = tighter.base64;
      } catch {
        // keep initial compressed base64
      }
    }
    return {
      url: fallbackUrl,
      storedInCloud: false,
      error: err?.message || 'Storage upload failed',
    };
  }
}

/**
 * Resolves Google Drive shareable URLs into direct, web-embeddable image URLs.
 * Supports patterns like:
 * - https://drive.google.com/file/d/FILE_ID/view...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID/edit
 * Returns a high-performance, web-embeddable URL: https://lh3.googleusercontent.com/d/FILE_ID
 */
export function resolveGoogleDriveUrl(url: string | undefined | null): string {
  if (!url) return '';
  const cleanedUrl = url.trim();

  // If it's already a direct Google drive usercontent/Cdn link, return directly
  if (cleanedUrl.includes('lh3.googleusercontent.com')) {
    return cleanedUrl;
  }

  // Pattern 1: /file/d/FILE_ID/...
  const fileDMatch = cleanedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  // Pattern 2: id=FILE_ID inside query string
  const idMatch = cleanedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  // Pattern 3: direct path /d/FILE_ID (and matches google domain)
  const dPathMatch = cleanedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dPathMatch && dPathMatch[1] && (cleanedUrl.includes('drive.google.com') || cleanedUrl.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${dPathMatch[1]}`;
  }

  return cleanedUrl;
}
