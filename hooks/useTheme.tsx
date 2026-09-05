import { useCallback } from 'react';
import { useAppearance } from './useAppearance';

/**
 * Kept for the components that only need a light/dark switch. The preference
 * itself, including "System", lives in {@link useAppearance}.
 */
export const useTheme = () => {
  const { resolvedTheme, setTheme } = useAppearance();

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return { theme: resolvedTheme, toggleTheme };
};
