module.exports = {
  "parserOptions": {
    "ecmaVersion": 2017,
    "impliedStrict" : true
  },
  'env': {
    'node': true,
  },
  'extends': 'airbnb-base',
  'plugins': [
    'import',
    'mocha'
  ],
  "rules": {
    "no-plusplus": "off",
    "strict" : "off",
    "lines-around-directive" : "off",
    "no-underscore-dangle": ["error", { "allow": ["__get__"] }],
    "no-param-reassign": "off",
    "no-unused-vars": ["error", { "varsIgnorePattern": "^should$" }]
  }
};