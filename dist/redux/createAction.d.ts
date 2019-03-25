import { Action } from '../interface';
export default function createAction(type: any, payloadCreator?: {
    <T>(value: T): T;
    (): undefined;
}, metaCreator?: any): {
    (...args: any[]): Action;
    toString(): any;
};
