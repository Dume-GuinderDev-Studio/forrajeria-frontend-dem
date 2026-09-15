/**
 * Logs out to console only during development.
 * Safely strips these logs away from production builds.
 */
export const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export const devWarn = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

export const devError = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
};
