type Rgb = [number, number, number];

const parse = (css: string): Rgb | undefined => {
  const n = css.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return n?.length === 3 ? (n as Rgb) : undefined;
};

const lin = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** WCAG 2.x contrast ratio of two CSS `rgb()/rgba()` colours (alpha ignored). */
export function contrastRatio(fg: string, bg: string): number | undefined {
  const a = parse(fg);
  const b = parse(bg);
  if (!a || !b) return undefined;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
