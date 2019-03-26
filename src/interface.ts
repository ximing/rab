export interface reducerFunc<T>{
    (state:T,action:any):T;
}

export interface reducerObj<T>{
    start?:reducerFunc<T>;
    next?:reducerFunc<T>;
    success?:reducerFunc<T>;
    throw?:reducerFunc<T>;
    error?:reducerFunc<T>;
    finish?:reducerFunc<T>;
}

export interface RabOptions{
    history:History;
    initialState:object;
    debug:boolean;
    simple:boolean;
}

export interface Action{
    type:string;
    meta?:object;
    payload?:any;
    error?:boolean;
}