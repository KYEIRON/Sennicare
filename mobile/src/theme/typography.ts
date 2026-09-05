import { Platform } from 'react-native';

/**
 * V28 sets its display face to `Iowan Old Style, Palatino, Georgia, serif`.
 * Iowan Old Style ships with iOS; Android has no equivalent, so the serif
 * fallback is used there.
 *
 * To make the two platforms identical, bundle a licensed serif and set
 * `DISPLAY_FONT` to its family name (see mobile/README.md).
 */
export const displayFont = Platform.select({
  ios: 'Iowan Old Style',
  android: 'serif',
  default: 'Georgia',
});

export const bodyFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});
