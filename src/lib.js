/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';
export const call = (type, payload) {
    return {
        type: type,
        payload: payload
    }
}