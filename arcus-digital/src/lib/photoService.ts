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

/**
 * Uploads a file or blob to Firebase Storage at the specified path.
 * Falls back to returning empty string or raising error on failure.
 */
export async function uploadPhotoToStorage(
  blob: Blob | File,
  storagePath: string
): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized');
  }
  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
  });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return downloadUrl;
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
