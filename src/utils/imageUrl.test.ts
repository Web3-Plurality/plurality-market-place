import { describe, expect, it } from 'vitest';
import { optimizeImageUrl } from './imageUrl';

describe('optimizeImageUrl', () => {
  it('inserts a Cloudinary transform for untransformed upload URLs', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1712345678/plurality/nft-covers/abc.png';
    expect(optimizeImageUrl(url, 640)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v1712345678/plurality/nft-covers/abc.png',
    );
  });

  it('leaves already-transformed Cloudinary URLs alone', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/w_300,c_fill/v1/x.jpg';
    expect(optimizeImageUrl(url, 640)).toBe(url);
  });

  it('passes through non-Cloudinary and data URLs unchanged', () => {
    expect(optimizeImageUrl('https://example.com/image/upload/x.png', 640)).toBe('https://example.com/image/upload/x.png');
    expect(optimizeImageUrl('data:image/png;base64,AAAA', 640)).toBe('data:image/png;base64,AAAA');
  });

  it('returns undefined for empty input', () => {
    expect(optimizeImageUrl(null, 640)).toBeUndefined();
    expect(optimizeImageUrl('', 640)).toBeUndefined();
  });
});
