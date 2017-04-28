/**
 * Created by yeanzhi on 17/4/27.
 */
'use strict';
module.exports = require('./src/index.js');
module.exports.connect = require('react-redux').connect;
module.exports.handleActions = require('xm-redux-actions').handleActions;
module.exports.createAction = require('xm-redux-actions').createAction;
