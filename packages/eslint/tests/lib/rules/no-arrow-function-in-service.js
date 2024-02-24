/**
 * @fileoverview Service dont allow arrow function
 * @author ximing
 */
const path = require('path');
// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------
const { RuleTester } = require('eslint');
const rule = require('../../../lib/rules/no-arrow-function-in-service');

// ------------------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------------------

const ruleTester = new RuleTester({
  parser: path.resolve('node_modules/@babel/eslint-parser'),
  parserOptions: { ecmaVersion: 2018 },
});

ruleTester.run('no-arrow-function-in-service', rule, {
  valid: [
    `class IndexService extends Service {
    add (num){
        this.count += num;
    }
}`,
    // give me some code that won't trigger a warning
  ],

  invalid: [
    {
      code: `
class IndexService extends Service {
    add = (num) =>{
        this.count += num;
    }
}
            `,
      errors: [
        {
          message: 'Service dont allow arrow function: function name is add',
          type: 'ClassProperty',
        },
      ],
    },
  ],
});
