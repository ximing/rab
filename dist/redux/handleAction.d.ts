import { reducerFunc, reducerObj } from '../interface';
export default function handleAction(type: string, reducer: reducerFunc<any> | reducerObj<any>, defaultState: object): (state: object, action: any) => object;
