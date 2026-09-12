/**
 * Cloudinary delivers the ORIGINAL upload unless the URL carries a
 * transformation, and covers may be up to 10 MB. Cards, thumbnails and the
 * hero were painting multi-megabyte images, which is most of the scroll
 * jank on the marketplace. Insert an on-the-fly transform (auto format,
 * auto quality, capped width) for Cloudinary URLs; leave every other URL
 * (data: URLs from bucket images, external hosts) untouched.
 */
const CLOUDINARY_UPLOAD = '/image/upload/';

export function optimizeImageUrl(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  const at = url.indexOf(CLOUDINARY_UPLOAD);
  if (at === -1 || !/res\.cloudinary\.com/.test(url)) return url;
  const rest = url.slice(at + CLOUDINARY_UPLOAD.length);
  // Already transformed (e.g. "f_auto,q_auto/..."): leave as is.
  if (/^[a-z]{1,3}_[^/]+\//.test(rest)) return url;
  return `${url.slice(0, at + CLOUDINARY_UPLOAD.length)}f_auto,q_auto,c_limit,w_${width}/${rest}`;
}
