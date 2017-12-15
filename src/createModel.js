/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
import warning from 'warning';
import createAction from './redux/createAction';
import {setAction} from './actions';
import {SEP} from './constants';

export default function (model) {
    const {
        namespace
    } = model;

    function applyNamespace(type) {
        function getNamespacedReducers(reducers) {
            return Object.keys(reducers).reduce((memo, key) => {
                warning(
                    key.indexOf(`${namespace}${SEP}`) !== 0,
                    `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`
                );
                memo[`${namespace}${SEP}${key}`] = reducers[key];
                return memo;
            }, {});
        }

        function getNamespacedMutations(actions) {
            return Object.keys(actions).reduce((memo, key) => {
                warning(
                    key.indexOf(`${namespace}${SEP}`) !== 0,
                    `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`
                );
                memo[`${key}`] = createAction(`${namespace}${SEP}${key}`, actions[key]);
                setAction(`${namespace}${SEP}${key}`, memo[`${key}`]);

                return memo;
            }, {});
        }

        if (model[type]) {
            if (type === 'reducers') {
                model[type] = getNamespacedReducers(model[type]);
            } else if (type === 'actions') {
                model[type] = getNamespacedMutations(model[type]);
            }
        }
    }

    applyNamespace('reducers');
    applyNamespace('actions');

    return model;
}
