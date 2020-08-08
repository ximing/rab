/**
 * @fileoverview Service dont allow arrow function
 * @author ximing
 */
'use strict';

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Service dont allow arrow function',
      category: 'Fill me in',
      recommended: false,
    },
    fixable: null, // or "code" or "whitespace"
    schema: [
      // fill in your schema
    ],
    messages: {
      avoidMethod: 'Service dont allow arrow function: function name is {{name}}',
    },
  },

  create: function (context) {
    let isService = false;

    return {
      ClassDeclaration: (node) => {
        if (node.superClass && node.superClass.name === 'Service') {
          isService = true;
        }
      },
      ClassProperty: (node) => {
        if (node.value && node.value.type === 'ArrowFunctionExpression') {
          if (isService) {
            context.report({
              node,
              messageId: 'avoidMethod',
              data: {
                name: node.key.name,
              },
            });
          }
        }
      },
    };
  },
};
