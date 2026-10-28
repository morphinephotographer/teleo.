/** Existing multiplier bounds. Presets/imports retain valid off-grid values. */
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 3;
export function stepSpeed(
  value: number,
  direction: -1 | 1,
  min = SPEED_MIN,
  max = SPEED_MAX,
) {
  if (![value, min, max].every(Number.isFinite) || min > max) return value;
  const scaled = value * 10,
    nearest = Math.round(scaled);
  const tick =
    Math.abs(scaled - nearest) < 1e-9
      ? nearest + direction
      : direction > 0
        ? Math.floor(scaled) + 1
        : Math.ceil(scaled) - 1;
  return tick >= Math.ceil(min * 10 - 1e-9) &&
    tick <= Math.floor(max * 10 + 1e-9)
    ? tick / 10
    : value;
}
export function formatSpeed(value: number) {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
    ? value.toFixed(1)
    : String(value);
}
