type PayloadMethodKeySet<M, K extends keyof M = Exclude<keyof M, keyof A>> = {
    [key in K]: M[key] extends (() => any) | ((payload: any) => Promise<any>) ? key : never;
}[K];

export type ActionMethodOfService<M extends A> = {
    [key in keyof Pick<M, PayloadMethodKeySet<M>>]: () => ReturnType<M[key]>;
};

class A {
    abc() {}
    getActions<M extends A>(this: M): ActionMethodOfService<M> {
        // @ts-ignore
        return {};
    }
}

class B extends A {
    hello() {
        return 123;
    }
    async d() {
        const res = this.hello();
        return res;
    }
}

const b = new B();
const res = b.getActions().d();
