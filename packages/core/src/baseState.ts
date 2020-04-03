import { subscribeFunction } from './types';

export class BaseState<State> {
    state: State;

    subscribeList: subscribeFunction<State>[] = [];

    constructor(state: State) {

        this.state = state;
    }

    subscribe(fn: subscribeFunction<State>) {
        this.subscribeList.push(fn);
        return () => {
            this.subscribeList = this.subscribeList.filter((sub) => sub !== fn);
        };
    }

    getState() {
        return this.state;
    }

    setState(newState: State) {
        this.state = newState;
        this.subscribeList.forEach((sub) => {
            try {
                sub(newState);
            } catch (e) {
                console.error(e);
            }
        });
    }

    destory() {
        this.subscribeList = [];
        // this.state = null;
    }
}
