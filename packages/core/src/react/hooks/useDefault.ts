import { useMemo } from 'react';

export const useDefault = <T>(args: any, defaultOptions: T) => {
  return useMemo(() => {
    const options: T = defaultOptions;
    return { ...options, ...args } as T;
  }, [args, defaultOptions]);
};
