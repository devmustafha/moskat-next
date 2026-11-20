/**
 * Photography for the marketing pages, served from Unsplash's CDN (free to use under the
 * Unsplash License). `src` is the base URL; components/ui/photo.tsx adds sizing parameters.
 */
export type ImageAsset = {
  src: string;
  /** Intrinsic aspect ratio used for layout; the CDN crops to it. */
  width: number;
  height: number;
  alt: string;
  credit: string;
};

export const images = {
  hero: {
    src: "https://images.unsplash.com/photo-1631815590058-860e4f83c1e8",
    width: 1200,
    height: 1350,
    alt: "A smiling nurse in blue scrubs checks a patient's blood pressure while she smiles back",
    credit: "CDC on Unsplash",
  },
  videoConsultation: {
    src: "https://images.unsplash.com/photo-1758691461932-d0aa0ebf6b31",
    width: 1200,
    height: 900,
    alt: "A doctor speaks with a smiling patient over a video call on a laptop",
    credit: "Vitaly Gariev on Unsplash",
  },
  waitingRoom: {
    src: "https://images.unsplash.com/photo-1629909614456-6b1c5c94cecc",
    width: 1200,
    height: 900,
    alt: "A bright, quiet waiting area with teal sofas and a plant",
    credit: "Benyamin Bohlouli on Unsplash",
  },
} satisfies Record<string, ImageAsset>;
