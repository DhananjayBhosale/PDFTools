import React from 'react';
import type { ToolCardData } from './toolCatalog';

export interface ToolIdentityProps {
  tool: Pick<ToolCardData, 'icon' | 'iconAsset'>;
  size?: number;
  assetSize?: number;
  className?: string;
  assetClassName?: string;
  strokeWidth?: number;
  /** Set on the few marks that are above the fold on first paint. */
  eager?: boolean;
}

/** Decorative tool identity: the Android mark when shared, Lucide otherwise. */
export const ToolIdentity: React.FC<ToolIdentityProps> = ({
  tool,
  size = 20,
  assetSize = size,
  className,
  assetClassName,
  strokeWidth = 1.9,
  eager = false,
}) => {
  if (tool.iconAsset) {
    return (
      <img
        src={tool.iconAsset}
        alt=""
        aria-hidden="true"
        width={assetSize}
        height={assetSize}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={assetClassName}
      />
    );
  }

  const Icon = tool.icon;
  return <Icon aria-hidden="true" size={size} strokeWidth={strokeWidth} className={className} />;
};
