export type CompressionLevel = 'extreme' | 'recommended' | 'less';

export interface AdaptiveConfig {
  scale: number;
  quality: number;
  projectedDPI: number;
}

export const getAdaptiveConfig = (
  level: CompressionLevel,
  isTextHeavy: boolean,
): AdaptiveConfig => {
  const dpiMap: Record<CompressionLevel, number> = {
    extreme: 72,
    recommended: 144,
    less: 200,
  };
  const targetDPI = isTextHeavy ? Math.max(dpiMap[level], 96) : dpiMap[level];
  const baseQuality = level === 'extreme' ? 0.5 : level === 'recommended' ? 0.75 : 0.9;

  return {
    scale: Math.min(1, targetDPI / 144),
    quality: isTextHeavy ? Math.min(0.95, baseQuality + 0.08) : baseQuality,
    projectedDPI: targetDPI,
  };
};

export const getInterpolatedConfig = (
  sliderValue: number,
  isTextHeavy: boolean,
): AdaptiveConfig => {
  const minDPI = isTextHeavy ? 96 : 72;
  const maxDPI = 300;
  const dpi = minDPI + (sliderValue / 100) * (maxDPI - minDPI);

  return {
    scale: Math.min(1, dpi / 144),
    quality: 0.5 + (sliderValue / 200),
    projectedDPI: Math.round(dpi),
  };
};

export const calculateTargetSize = (
  originalSize: number,
  level: CompressionLevel,
  isTextHeavy: boolean,
): number => {
  const baseRatio = level === 'extreme' ? 0.3 : level === 'recommended' ? 0.6 : 0.9;
  const ratio = isTextHeavy ? Math.min(0.95, baseRatio + 0.12) : baseRatio;
  return Math.round(originalSize * ratio);
};
