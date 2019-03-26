/**
 * Created by yeanzhi on 17/4/27.
 */
'use strict';
import * as _ from 'lodash';
import * as invariant from 'invariant';

import {Action} from '../interface';

const identity = _.identity;
const isFunction = _.isFunction;
const isUndefined = _.isUndefined;
const isNull = _.isNull;


export default function createAction(type, payloadCreator = identity, metaCreator?) {
    invariant(
        isFunction(payloadCreator) || isNull(payloadCreator),
        'Expected payloadCreator to be a function, undefined or null'
    );

    const finalPayloadCreator :any = isNull(payloadCreator)
        ? identity
        : payloadCreator;

    const actionCreator = (...args) => {
        const hasError = args[0] instanceof Error;

        let action : Action = {
            type,
            meta: {
                'action-redux/payload': [...args]
            },
        };

        const payload = hasError ? args[0] : finalPayloadCreator(...args);

        if (!isUndefined(payload)) {
            action.payload = payload;
        }

        if (hasError || payload instanceof Error) {
            // Handle FSA errors where the payload is an Error object. Set error.
            action.error = true;
        }

        if (isFunction(metaCreator)) {
            action.meta = Object.assign(action.meta,{...metaCreator(...args)});
        }

        return action;
    };

    actionCreator.toString = () => type.toString();

    return actionCreator;
}
