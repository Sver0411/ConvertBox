export function outputDimensions(sourceWidth: number, sourceHeight: number, width = 0, height = 0): [number, number] {
  if (!width && !height) return [sourceWidth, sourceHeight];
  if (width && height) {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    return [Math.max(1, Math.round(sourceWidth * scale)), Math.max(1, Math.round(sourceHeight * scale))];
  }
  if (width) return [width, Math.max(1, Math.round(sourceHeight * width / sourceWidth))];
  return [Math.max(1, Math.round(sourceWidth * height / sourceHeight)), height];
}
