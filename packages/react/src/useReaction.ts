import { observe, unobserve, type Reaction, type ObserveOptions } from '@rabjs/observer';
import { useEffect, useRef } from 'react';

export interface UseReactionOptions extends ObserveOptions {
  immediate?: boolean;
}

export function useReaction(effect: () => void | (() => void), options?: UseReactionOptions): void {
  const reactionRef = useRef<Reaction | null>(null);
  const { immediate, ...observeOptions } = options || {};

  useEffect(() => {
    if (reactionRef.current) {
      unobserve(reactionRef.current);
    }

    const shouldLazy = immediate !== true;

    const reaction = observe(effect, {
      ...observeOptions,
      lazy: shouldLazy,
    });

    reactionRef.current = reaction;

    return () => {
      if (reactionRef.current) {
        unobserve(reactionRef.current);
        reactionRef.current = null;
      }
    };
  }, []);
}
