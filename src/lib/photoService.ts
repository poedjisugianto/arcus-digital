import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { auth, storage } from '../firebase';

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

          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', quality);

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
  extension: 'jpg' | 'png' | 'webp' | 'svg';
}

function supportsWebpEncode(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Compresses an image smartly: preserves transparency (WebP/PNG/SVG) when preserveAlpha is true,
 * and uses compact JPEG otherwise. Prefers WebP over PNG for alpha images so sizes stay compact.
 */
export function compressImageSmart(
  file: File,
  options: { maxDim?: number; quality?: number; preserveAlpha?: boolean; forceCompact?: boolean } = {}
): Promise<SmartCompressedImage> {
  const { maxDim = 1200, quality = 0.8, preserveAlpha = false, forceCompact = false } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;

      if (file.type === 'image/svg+xml' && preserveAlpha && !forceCompact && dataUrl.length < 100000) {
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

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const isAlphaExt = /\.(png|webp|svg)$/i.test(file.name || '');
          const isAlphaMime = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml';
          const wantsAlpha = preserveAlpha && (isAlphaMime || isAlphaExt || file.type === '');
          const canWebp = wantsAlpha && supportsWebpEncode(canvas);

          let mime: string = 'image/jpeg';
          let ext: 'jpg' | 'png' | 'webp' = 'jpg';

          if (wantsAlpha) {
            if (canWebp) {
              mime = 'image/webp';
              ext = 'webp';
            } else if (!forceCompact) {
              mime = 'image/png';
              ext = 'png';
            } else {
              // Fill white background for JPEG fallback so transparent pixels don't turn black
              ctx.globalCompositeOperation = 'destination-over';
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              mime = 'image/jpeg';
              ext = 'jpg';
            }
          } else {
            // Ensure transparent areas on non-alpha JPEGs fill with white instead of solid black
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          const base64 =
            mime === 'image/png'
              ? canvas.toDataURL('image/png')
              : canvas.toDataURL(mime, quality);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ base64, blob, contentType: mime, extension: ext });
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            mime,
            mime === 'image/png' ? undefined : quality
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

async function uploadToBucketWithTimeout(
  storageInstance: any,
  blob: Blob | File,
  storagePath: string,
  contentType: string,
  timeoutMs: number
): Promise<string> {
  const storageRef = ref(storageInstance, storagePath);
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

function getAlternateBucketUrl(primaryBucket?: string, projectId?: string): string | null {
  const cleanBucket = (primaryBucket || '').replace(/^gs:\/\//, '').trim();
  const pid = (projectId || '').trim();
  if (!cleanBucket && !pid) return null;

  if (cleanBucket.endsWith('.firebasestorage.app')) {
    return `gs://${cleanBucket.replace('.firebasestorage.app', '.appspot.com')}`;
  }
  if (cleanBucket.endsWith('.appspot.com')) {
    return `gs://${cleanBucket.replace('.appspot.com', '.firebasestorage.app')}`;
  }
  if (pid) {
    return `gs://${pid}.appspot.com`;
  }
  return null;
}

let storageUnavailableUntil = 0;

/**
 * Uploads a file or blob to Firebase Storage with alternate path, alternate bucket, and server API fallbacks.
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

  if (Date.now() < storageUnavailableUntil) {
    throw new Error('Firebase Storage sementara tidak tersedia');
  }

  const primaryBucket = storage.app.options.storageBucket;
  const projectId = storage.app.options.projectId;
  const altBucketUrl = getAlternateBucketUrl(primaryBucket, projectId);
  const perAttemptTimeout = Math.min(timeoutMs, 12000);

  const attemptUpload = async (targetStorage: any, path: string) => {
    return await uploadToBucketWithTimeout(targetStorage, blob, path, contentType, perAttemptTimeout);
  };

  try {
    return await attemptUpload(storage, storagePath);
  } catch (primaryErr: any) {
    const errCode = primaryErr?.code || '';
    const errMsg = String(primaryErr?.message || primaryErr || '');
    console.warn(`[Storage] Primary upload failed (${errCode}):`, errMsg);

    // 1. Always try registrations/public_assets/ (open rule in storage.rules) unless explicitly canceled
    if (!storagePath.startsWith('registrations/') && errCode !== 'storage/canceled') {
      try {
        const publicPath = `registrations/public_assets/${storagePath}`;
        return await attemptUpload(storage, publicPath);
      } catch (pubErr: any) {
        console.warn('[Storage] Public path fallback failed:', pubErr?.message || pubErr);
      }
    }

    // 2. If bucket-not-found or unknown error, try alternate Firebase bucket suffix (.appspot.com <-> .firebasestorage.app)
    if (altBucketUrl) {
      try {
        const altStorage = getStorage(storage.app, altBucketUrl);
        try {
          return await attemptUpload(altStorage, storagePath);
        } catch (altPathErr: any) {
          if (!storagePath.startsWith('registrations/')) {
            return await attemptUpload(altStorage, `registrations/public_assets/${storagePath}`);
          }
          throw altPathErr;
        }
      } catch (altErr: any) {
        console.warn('[Storage] Alternate bucket upload failed:', altErr?.message || altErr);
      }
    }

    // 3. Server-side Storage API fallback (with Firebase Auth token & configured bucket)
    let serverReason = '';
    if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
      try {
        const base64Payload = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => reject(new Error('FileReader failed'));
          r.readAsDataURL(blob);
        });
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const idToken = await auth?.currentUser?.getIdToken?.();
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }
        } catch {}
        const res = await fetch('/api/storage/upload', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            path: storagePath,
            contentType: blob.type || contentType,
            dataUrl: base64Payload,
            bucket: primaryBucket,
          }),
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.success && body?.url) {
            storageUnavailableUntil = 0;
            return body.url;
          }
          if (body?.storageUnavailable) {
            storageUnavailableUntil = Date.now() + 60000;
          }
          if (body?.message) {
            serverReason = String(body.message);
            console.info('[Storage] Server fallback info:', serverReason);
          }
        }
      } catch (serverErr: any) {
        console.warn('[Storage] Server upload fallback unavailable:', serverErr?.message || serverErr);
      }
    }

    if (serverReason) {
      throw new Error(serverReason);
    }
    throw primaryErr;
  }
}

/**
 * Compresses an image file and uploads it to Firebase Storage.
 * Falls back to strictly compact Base64 (<= 75KB) ONLY if all Storage uploads fail.
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
    fallbackMaxDim = 650,
    fallbackQuality = 0.58,
    timeoutMs = 35000,
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

    // Strictly ensure fallback Base64 is tiny (<= 75KB) so Firestore 1MB limit is never exceeded
    if (fallbackUrl.length > 75000) {
      const steps = [
        { maxDim: fallbackMaxDim, quality: fallbackQuality, forceCompact: true },
        { maxDim: 480, quality: 0.5, forceCompact: true },
        { maxDim: 320, quality: 0.42, forceCompact: true },
      ];
      for (const step of steps) {
        try {
          const tighter = await compressImageSmart(file, {
            maxDim: step.maxDim,
            quality: step.quality,
            preserveAlpha,
            forceCompact: step.forceCompact,
          });
          fallbackUrl = tighter.base64;
          if (fallbackUrl.length <= 75000) break;
        } catch {
          break;
        }
      }
    }

    return {
      url: fallbackUrl,
      storedInCloud: false,
      error: err?.code || err?.message || 'Storage upload failed',
    };
  }
}

/**
 * Converts a Base64 data:image URL into a File object for uploading to Firebase Storage
 */
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    return new File([blob], `${filename}.${ext}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

/**
 * Migrates any inline Base64 data:image strings in TournamentSettings to Firebase Storage URLs.
 * Keeps Firestore documents lightweight (< 50KB) even for older events.
 */
export async function migrateSettingsImagesToStorage<T extends Record<string, any>>(
  eventId: string,
  settings: T
): Promise<{ settings: T; migratedCount: number; failedCount: number }> {
  if (!settings || typeof settings !== 'object') {
    return { settings, migratedCount: 0, failedCount: 0 };
  }

  let migratedCount = 0;
  let failedCount = 0;
  const folder = eventId || 'temp';
  const next: any = { ...settings };

  const tryMigrateField = async (
    val: any,
    pathSuffix: string,
    opts: { maxDim?: number; quality?: number; preserveAlpha?: boolean } = {}
  ): Promise<string> => {
    if (typeof val !== 'string' || !val.startsWith('data:image/')) {
      return val;
    }
    const file = await dataUrlToFile(val, pathSuffix);
    if (!file) {
      failedCount++;
      return val;
    }
    try {
      const res = await uploadImageAsset(
        file,
        `tournaments/${folder}/migrated_${pathSuffix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        opts
      );
      if (res.storedInCloud) {
        migratedCount++;
        return res.url;
      }
      failedCount++;
      // Keep the smaller version if it shrank significantly
      return res.url.length < val.length ? res.url : val;
    } catch {
      failedCount++;
      return val;
    }
  };

  next.logoUrl = await tryMigrateField(next.logoUrl, 'logo_event', { maxDim: 600, quality: 0.85, preserveAlpha: true });
  next.secondaryLogoUrl = await tryMigrateField(next.secondaryLogoUrl, 'logo_inorga', { maxDim: 600, quality: 0.85, preserveAlpha: true });
  next.clubLogoUrl = await tryMigrateField(next.clubLogoUrl, 'logo_club', { maxDim: 600, quality: 0.85, preserveAlpha: true });
  next.pamphletUrl = await tryMigrateField(next.pamphletUrl, 'pamphlet', { maxDim: 1200, quality: 0.82 });

  if (Array.isArray(next.sponsorships)) {
    next.sponsorships = await Promise.all(
      next.sponsorships.map(async (sp: any, idx: number) => {
        if (!sp || typeof sp !== 'object') return sp;
        const logoUrl = await tryMigrateField(sp.logoUrl, `sponsor_${idx}`, { maxDim: 600, quality: 0.85, preserveAlpha: true });
        return { ...sp, logoUrl };
      })
    );
  }

  if (next.certificateConfig && typeof next.certificateConfig === 'object') {
    const cert = { ...next.certificateConfig };
    cert.customBackgroundUrl = await tryMigrateField(cert.customBackgroundUrl, 'cert_blanko', {
      maxDim: 1600,
      quality: 0.85,
      preserveAlpha: true,
    });
    cert.customStampUrl = await tryMigrateField(cert.customStampUrl, 'cert_stamp', {
      maxDim: 600,
      quality: 0.88,
      preserveAlpha: true,
    });
    if (Array.isArray(cert.signatories)) {
      cert.signatories = await Promise.all(
        cert.signatories.map(async (sig: any, idx: number) => {
          if (!sig || typeof sig !== 'object') return sig;
          const signatureUrl = await tryMigrateField(sig.signatureUrl, `cert_sig_${idx}`, {
            maxDim: 600,
            quality: 0.88,
            preserveAlpha: true,
          });
          return { ...sig, signatureUrl };
        })
      );
    }
    next.certificateConfig = cert;
  }

  return { settings: next as T, migratedCount, failedCount };
}

/**
 * Strips any giant inline Base64 data: URLs (> maxLen) while keeping HTTPS Storage URLs intact.
 */
export function stripOversizedDataUrls<T>(val: T, maxLen: number = 40000): T {
  if (typeof val === 'string') {
    if (val.startsWith('data:') && val.length > maxLen) {
      return '' as any;
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripOversizedDataUrls(item, maxLen)) as any;
  }
  if (val && typeof val === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = stripOversizedDataUrls(v, maxLen);
    }
    return out;
  }
  return val;
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

  if (cleanedUrl.includes('lh3.googleusercontent.com')) {
    return cleanedUrl;
  }

  const fileDMatch = cleanedUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  const idMatch = cleanedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  const dPathMatch = cleanedUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dPathMatch && dPathMatch[1] && (cleanedUrl.includes('drive.google.com') || cleanedUrl.includes('docs.google.com'))) {
    return `https://lh3.googleusercontent.com/d/${dPathMatch[1]}`;
  }

  return cleanedUrl;
}
