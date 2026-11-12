import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';

/**
 * Makes every framer-motion animation under the app root follow the operating
 * system "reduce motion" setting. With `reducedMotion="user"`, transform and
 * layout animations are skipped for people who asked for less motion, while
 * opacity and colour transitions are kept so state changes stay visible.
 */
export function AccessibleMotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export default AccessibleMotionProvider;
