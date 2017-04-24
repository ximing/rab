// module.exports = require('./dist/rabjs.js');
module.exports = require('./src/index.js');
module.exports.connect = require('react-redux').connect;
module.exports.handleActions = require('xm-redux-actions').handleActions;
module.exports.createAction = require('xm-redux-actions').createAction;
