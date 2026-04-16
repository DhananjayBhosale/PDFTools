import React from 'react';

const MOTION_PROPS = new Set([
  'animate',
  'exit',
  'initial',
  'transition',
  'variants',
  'whileHover',
  'whileTap',
  'whileInView',
  'layout',
  'layoutId',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'dragTransition',
  'custom',
  'viewport',
  'onViewportEnter',
  'onViewportLeave',
]);

const stripMotionProps = (props: Record<string, unknown>) => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!MOTION_PROPS.has(key)) {
      next[key] = value;
    }
  }
  return next;
};

const motionComponentCache = new Map<string, React.ComponentType<any>>();

const motion = new Proxy(
  {},
  {
    get: (_target, tag: string) => {
      const key = String(tag);
      const cached = motionComponentCache.get(key);
      if (cached) return cached;

      const Component = React.forwardRef<any, any>((props, ref) =>
        React.createElement(key, { ...stripMotionProps(props), ref }, props.children),
      );
      Component.displayName = `motion.${key}`;
      motionComponentCache.set(key, Component);
      return Component;
    },
  },
) as Record<string, React.ComponentType<any>>;

const AnimatePresence: React.FC<{ children?: React.ReactNode; [key: string]: unknown }> = ({ children }) => <>{children}</>;

const useReducedMotion = () => true;

export { motion, AnimatePresence, useReducedMotion };
