import { useEffect } from 'react';

/**
 * Sets `document.title` to "{title} | PETROS IPS" for the lifetime of the
 * mounted component, then restores the default on unmount.
 *
 * Pass an empty string to use just "PETROS IPS".
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} | PETROS IPS` : 'PETROS IPS';
    return () => {
      document.title = 'PETROS IPS';
    };
  }, [title]);
}
