import { Service } from '../service';
import { useRef, useState, useEffect } from 'react';
import { shallowEqual } from '../utils/helpers';

export function useServiceSelector<
    M extends Service<any>,
    S = M extends Service<infer SS> ? SS : never,
    F = S
>(service: M, selector?: (state: Readonly<S>) => F): F {
    const serviceRef = useRef<Service<any> | null>(null);
    const subscriptionRef = useRef<Function | null>(null);
    const [state, setState] = useState(() =>
        selector ? selector(service.getState()) : service.getState()
    );
    if (serviceRef.current !== service) {
        // const count = serviceRef.current === null ? 1 : 0;
        serviceRef.current = service;
        if (subscriptionRef.current) {
            subscriptionRef.current();
            subscriptionRef.current = null;
        }

        if (service) {
            subscriptionRef.current = service.subscribe((s) => {
                const ns = selector ? selector(s) : s;
                if (shallowEqual(ns, state)) {
                    setState(ns);
                }
            });
        }
    }

    useEffect(
        () => () => {
            if (subscriptionRef.current) {
                subscriptionRef.current();
            }
        },
        [subscriptionRef]
    );
    return state;
}
