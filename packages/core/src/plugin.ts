import { Rab } from './rab';

export interface Plugin {
    beforeStart(rab: Rab): void;
    afterStart(rab: Rab): void;
}