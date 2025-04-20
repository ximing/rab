interface GlobalState {
  [modelName: string]: any;
}

const instrument = typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION__;
const STATE: GlobalState = {};

interface Action {
  type: string;
  params?: any;
}

type Reducer = (state: GlobalState | undefined, action: Action) => GlobalState | undefined;
const reducer: Reducer = () => (STATE ? { ...STATE } : STATE);

const createStore = (reducer: Reducer) => {
  let currentState: GlobalState = {};
  let subscribeFn: any[] = [];
  const getState = () => currentState;
  const dispatch = (action: Action) => {
    const newState = reducer(getState(), action) || {};
    subscribeFn.forEach((fn) => fn(newState));
    currentState = newState;
    return action;
  };
  dispatch({ type: '@@redux/INIT' });
  return {
    getState,
    dispatch,
    subscribe: (fn: Function) => {
      subscribeFn.push(fn);
      return () => {
        subscribeFn = subscribeFn.filter((i) => i !== fn);
      };
    },
  };
};

const store = instrument
  ? instrument({
      name: 'rabjs',
      pause: false, // start/pause recording of dispatched actions
      lock: false, // lock/unlock dispatching actions and side effects
      export: true, // export history of actions in a file
      import: 'custom', // import history of actions from a file
      jump: false, // jump back and forth (time travelling)
      skip: false, // Cannot skip for we cannot replay.
      reorder: false, // Cannot skip for we cannot replay.
      persist: false, // Avoid trying persistence.
      dispatch: false,
      test: false,
    })(createStore)(reducer)
  : undefined;

export function logStateAction(
  namespace: string,
  infos: { actionName: string; params: any; state?: any }
) {
  const action = {
    type: `${namespace}/${infos.actionName}`,
    params: infos.params,
  };

  if (infos.state) {
    STATE[namespace] = infos.state;
  }
  if (store) store.dispatch(action);
}
