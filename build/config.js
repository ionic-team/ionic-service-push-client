var fs = require('fs');
var pkg = require('../package.json');

module.exports = {
  banner:
    '/**\n' +
    ' * Ionic Push Module\n' +
    ' * Copyright 2015 Ionic http://ionicframework.com/\n' +
    ' * See LICENSE in this repository for license information\n' +
    ' */\n\n',

  dist: '.',

  jsFiles: [
    'src/push-token.js',
    'src/dev-push.js',
    'src/push.js',
    'src/angular-integration.js'
  ],

  versionData: {
    version: pkg.version
  }
};
