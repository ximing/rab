/**
 * @fileoverview eslint rules for rabjs
 * @author ximing
 */
'use strict';
//
// //------------------------------------------------------------------------------
// // Requirements
// //------------------------------------------------------------------------------
//
// var requireIndex = require("requireindex");
//
// //------------------------------------------------------------------------------
// // Plugin Definition
// //------------------------------------------------------------------------------
//
//
// // import all rules in lib/rules
// module.exports.rules = requireIndex(__dirname + "/rules");
//
//
//
module.exports = {
  rules: {
    'no-arrow-function-in-service': require('./rules/no-arrow-function-in-service.js'),
  },
  configs: {
    recommended: {
      rules: {
        'rabjs/no-arrow-function-in-service': 2,
      },
    },
  },
};
