// The signature move: each node page tunes its accent to the node's own
// broadcast `color`. But many nodes ship the default #000000 (or blank/garbage),
// and a color that reads on one background can vanish against the other — so
// each theme gets its own accent, falling back to the fixed voltage accent
// whenever the broadcast color can't be read on that theme's background.

const FALLBACK = "var(--volt)";

const isHex6 = (hex: string) => /^[0-9a-fA-F]{6}$/.test(hex);

const parseHex = (color?: string): string | undefined => {
  if (!color) return undefined;
  const hex = color.trim().replace(/^#/, "");
  return isHex6(hex) ? hex : undefined;
};

const luminance = (hex: string): number => {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** A CSS color safe to use as a page accent on the dark ("Instrument") theme,
 *  or the voltage fallback. */
export const nodeAccentDark = (color?: string): string => {
  const hex = parseHex(color);
  // Too dark to register against #0a0d13.
  if (hex === undefined || luminance(hex) < 0.12) return FALLBACK;
  return `#${hex}`;
};

/** A CSS color safe to use as a page accent on the light ("Daylight") theme,
 *  or the voltage fallback. */
export const nodeAccentLight = (color?: string): string => {
  const hex = parseHex(color);
  // Too light to register against #fbfbf9.
  if (hex === undefined || luminance(hex) > 0.75) return FALLBACK;
  return `#${hex}`;
};

/** The literal broadcast color for the identity chip, or a muted placeholder. */
export const nodeSwatch = (color?: string): string => {
  const hex = parseHex(color);
  return hex !== undefined ? `#${hex}` : "var(--muted-foreground)";
};
