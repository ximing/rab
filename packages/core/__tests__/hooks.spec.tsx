import * as React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { useCallback, useEffect } from 'react';

import {
    Service,
    Effect,
    Reducer,
    Injectable,
    useService,
    Transient,
    container,
    Singleton
} from '../src';

const wait = (fn: (...args: any[]) => any) => Promise.resolve().then(() => fn());
const waitMacro = (fn: (...args: any[]) => any) =>
    new Promise((res) =>
        setTimeout(() => {
            fn();
            res();
        })
    );
interface State {
    count: number;
    start: number;
}

enum CountAction {
    ADD = 'add',
    MINUS = 'minus'
}

@Injectable()
class Count extends Service<State> {
    defaultState = {
        count: 0,
        start: 0
    };

    @Reducer()
    add(state: State, count: number): State {
        return { ...state, count: state.count + count };
    }

    @Reducer()
    setCount(state: State, count: number): State {
        return { ...state, count };
    }

    @Effect()
    async minus(count: number, state: State) {
        this.getActions().hello
        this.getActions().minus(12345678)
        // this.getActions().minus()
        return  "123";
    }

    @Effect()
    async hello(){
        const a = await this.getActions().minus(1)
    }
}

function CountComponent({ scope }: { scope?: any }) {
    const [state, actions] = useService(Count, { scope: scope || Transient });

    const add = (count: number) => () => actions.add(count);
    const minus = (count: number) => () => actions.minus(count);

    return (
        <div>
            <p>
                current count is <span>{state.count}</span>
            </p>
            <button id={CountAction.ADD} onClick={add(1)}>
                add one
            </button>
            <button id={CountAction.MINUS} onClick={minus(1)}>
                minus one
            </button>
        </div>
    );
}

describe('Hooks spec:', () => {
    describe('Default behavior', () => {
        const testRenderer = create(<CountComponent />);
        const count = () => testRenderer.root.findByType('span').children[0];
        const click = async (action: CountAction) =>
            await act(async () => testRenderer.root.findByProps({ id: action }).props.onClick());
        // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
        testRenderer.update(<CountComponent />);

        it('default state work properly', () => {
            expect(count()).toBe('0');
        });

        it('Reducer action work properly', () => {
            click(CountAction.ADD);
            expect(count()).toBe('1');
        });

        it('Effect action work properly', async () => {
            click(CountAction.MINUS);
            await wait(() => expect(count()).toBe('0'));
        });

        it('should only render once when update the state right during rendering', async () => {
            const spy = jest.fn();
            const TestComponent = () => {
                const [state, actions] = useService(Count, { scope: Transient });
                const addOne = useCallback(() => actions.add(1), [actions]);

                if (state.count % 2 === 0) {
                    actions.add(1);
                }

                useEffect(() => {
                    spy(state.count);
                }, [state.count]);

                return (
                    <div>
                        <p>count: {state.count}</p>
                        <button onClick={addOne}>add one</button>
                    </div>
                );
            };

            const renderer = create(<TestComponent />);

            // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
            await act(async () => {
                renderer.update(<TestComponent />);
            });
            expect(spy.mock.calls).toEqual([[1]]);

            act(() => renderer.root.findByType('button').props.onClick());
            waitMacro(() => expect(spy.mock.calls).toEqual([[1], [3]]));
        });

        it('should not trigger re-render if selector is provided', async () => {
            const spy = jest.fn();

            const TestComponent = () => {
                const [state, actions] = useService(Count, () => undefined, { scope: Transient });
                expect(state).toBeUndefined();
                const addOne = useCallback(() => actions.add(1), [actions]);
                spy();
                return (
                    <div>
                        <button id={CountAction.ADD} onClick={addOne}>
                            add one
                        </button>
                    </div>
                );
            };
            const renderer = create(<TestComponent />);
            // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
            renderer.update(<TestComponent />);
            act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
            waitMacro(() => expect(spy.mock.calls).toHaveLength(2));
        });
        it('should not re-render if selector result is not change', () => {
            const spy = jest.fn();
            const TestComponent = () => {
                const [start, actions] = useService(Count, (state) => state.start, {
                    scope: Transient
                });
                const addOne = useCallback(() => actions.add(1), [actions]);
                spy();
                return (
                    <div>
                        <span>start: {start}</span>
                        <button id={CountAction.ADD} onClick={addOne}>
                            add one
                        </button>
                    </div>
                );
            };
            const renderer = create(<TestComponent />);
            // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
            renderer.update(<TestComponent />);
            act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
            expect(spy.mock.calls).toHaveLength(2);
        });
    });

    describe('Awake and Sleep', () => {
        describe('action trigger in sleep', () => {
            it('should not reaction when service is sleep', () => {
                const spy = jest.fn();
                const TestComponent = () => {
                    const [count, actions] = useService(Count, (state) => state.count);
                    useEffect(() => {
                        spy(count);
                    }, [count]);
                    return (
                        <div>
                            <button id={CountAction.ADD} onClick={() => actions.add(1)}>
                                add one
                            </button>
                        </div>
                    );
                };
                const renderer = create(<TestComponent />);
                // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
                renderer.update(<TestComponent />);

                act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
                // const count = container.resolveInScope(Count, Singleton);
                // count.sleep();
                act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
                act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
                // count.dispatch('reset', { payload: { count: 0 } });
                waitMacro(() => expect(spy.mock.calls).toEqual([[0], [1], [0]]));
            });
        });
    });
    describe('Scope behavior', () => {
        describe('Same scope will share state and actions', () => {
            const scope = Symbol('scope');
            let count: () => string | ReactTestInstance;
            let click: (action: CountAction) => void;

            beforeEach(() => {
                const testRenderer = create(<CountComponent scope={scope} />);

                count = () => testRenderer.root.findByType('span').children[0];
                click = (action: CountAction) =>
                    act(() => testRenderer.root.findByProps({ id: action }).props.onClick());

                // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
                testRenderer.update(<CountComponent scope={scope} />);
            });

            it('default state work properly', () => {
                expect(count()).toBe('0');
            });

            it('Reducer action work properly', () => {
                click(CountAction.ADD);
                expect(count()).toBe('1');
            });

            it('Effect action work properly', async () => {
                click(CountAction.MINUS);
                await wait(() => expect(count()).toBe('0'));
            });
        });

        describe('Different scope will isolate state and actions', () => {
            let count: () => string | ReactTestInstance;
            let click: (action: CountAction) => void;

            beforeEach(() => {
                const scope = Symbol('scope');
                const testRenderer = create(<CountComponent scope={scope} />);

                count = () => testRenderer.root.findByType('span').children[0];
                click = (action: CountAction) =>
                    act(() => testRenderer.root.findByProps({ id: action }).props.onClick());

                // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
                testRenderer.update(<CountComponent scope={scope} />);
            });

            it('Reducer action work properly', () => {
                click(CountAction.ADD);
                expect(count()).toBe('1');
            });

            it('default state work properly', () => {
                expect(count()).toBe('0');
            });

            it('Effect action work properly', async () => {
                click(CountAction.MINUS);
                await wait(() => expect(count()).toBe('-1'));
            });
        });

        describe('TransientScope will isolate state and actions', () => {
            let count: () => string | ReactTestInstance;
            let click: (action: CountAction) => void;
            let testRenderer: ReactTestRenderer;

            beforeEach(() => {
                testRenderer = create(<CountComponent scope={Transient} />);

                count = () => testRenderer.root.findByType('span').children[0];
                click = (action: CountAction) =>
                    act(() => testRenderer.root.findByProps({ id: action }).props.onClick());

                // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
                testRenderer.update(<CountComponent scope={Transient} />);
            });

            it('Reducer action work properly', () => {
                click(CountAction.ADD);
                expect(count()).toBe('1');
            });

            it('default state work properly', () => {
                expect(count()).toBe('0');
            });

            it('Effect action work properly', async () => {
                click(CountAction.MINUS);
                await wait(() => expect(count()).toBe('-1'));
            });

            // it('should destroy when component unmount', () => {
            //     const spy = jest.spyOn(Service.prototype, 'destroy');
            //     act(() => testRenderer.unmount());
            //     expect(spy.mock.calls.length).toBe(1);
            // });
        });

        describe('Dynamic update scope', () => {
            const testRenderer = create(<CountComponent scope={1} />);
            const count = () => testRenderer.root.findByType('span').children[0];
            const click = (action: CountAction) =>
                act(() => testRenderer.root.findByProps({ id: action }).props.onClick());

            it(`should use same Service at each update if scope didn't change`, () => {
                testRenderer.update(<CountComponent scope={1} />);
                click(CountAction.ADD);
                expect(count()).toBe('1');
            });

            it(`should use new scope's Service if scope changed`, async () => {
                testRenderer.update(<CountComponent scope={2} />);
                click(CountAction.MINUS);
                await wait(() => expect(count()).toBe('-1'));
            });

            it(`should update state to corresponding one`, () => {
                testRenderer.update(<CountComponent scope={1} />);
                expect(count()).toBe('1');
                testRenderer.update(<CountComponent scope={2} />);
                expect(count()).toBe('-1');
                testRenderer.update(<CountComponent scope={3} />);
                expect(count()).toBe('0');
            });
        });
    });
});
