/**
 * Google Maps Helper for Archery Events
 * Automatically resolves custom share link or fallback search query.
 */

export function getGoogleMapsUrl(location?: string, mapsUrl?: string): string | null {
  if (mapsUrl && mapsUrl.trim()) {
    return mapsUrl.trim();
  }

  if (location && location.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
  }

  return null;
}
