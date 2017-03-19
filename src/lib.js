/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';
module.export.call = function(type, payload) {
    return {
        type: type,
        payload: payload
    }
}
