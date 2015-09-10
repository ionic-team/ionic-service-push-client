(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Add Angular integrations if Angular is available
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

if (typeof angular === 'object' && angular.module) {
  angular.module('ionic.service.push', [])

  /**
   * IonicPushAction Service
   *
   * A utility service to kick off misc features as part of the Ionic Push service
   */
  .factory('$ionicPushAction', ['$state', function ($state) {
    var PushActionService = (function () {
      function PushActionService() {
        _classCallCheck(this, PushActionService);
      }

      _createClass(PushActionService, [{
        key: 'notificationNavigation',

        /**
         * State Navigation
         *
         * Attempts to navigate to a new view if a push notification payload contains:
         *
         *   - $state {String} The state name (e.g 'tab.chats')
         *   - $stateParams {Object} Provided state (url) params
         *
         * Find more info about state navigation and params:
         * https://github.com/angular-ui/ui-router/wiki
         *
         * @param {object} notification Notification Object
         * @return {void}
         */
        value: function notificationNavigation(notification) {
          var state = false;
          var stateParams = {};

          try {
            state = notification.additionalData.payload.$state;
          } catch (e) {
            state = false;
          }

          try {
            stateParams = JSON.parse(notification.additionalData.payload.$stateParams);
          } catch (e) {
            stateParams = {};
          }

          if (state) {
            $state.go(state, stateParams);
          }
        }
      }]);

      return PushActionService;
    })();

    return new PushActionService();
  }]).factory('$ionicPush', [function () {
    return Ionic.Push;
  }]).run(function ($ionicPushAction) {
    // This is what kicks off the state redirection when a push notificaiton has the relevant details
    Ionic.IO.Core.getEmitter().on('ionic_push:processNotification', function (notification) {
      if (notification.additionalData.foreground === false) {
        $ionicPushAction.notificationNavigation(notification);
      }
    });
  });
}

},{}],2:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

(function () {

  var ApiRequest = Ionic.IO.ApiRequest;
  var Settings = new Ionic.IO.Settings();

  /**
   * PushDev Service
   *
   * This service acts as a mock push service that is intended to be used pre-setup of
   * GCM/APNS in an Ionic.io project.
   *
   * How it works:
   *
   *   When register() is called, this service is used to generate a random
   *   development device token. This token is not valid for any service outside of
   *   Ionic Push with `dev_push` set to true. These tokens do not last long and are not
   *   eligible for use in a production app.
   *
   *   The device will then periodically check the Push service for push notifications sent
   *   to our development token -- so unlike a typical "push" update, this actually uses
   *   "polling" to find new notifications. This means you *MUST* have the application open
   *   and in the foreground to retreive messsages.
   *
   *   The callbacks provided in your init() will still be triggered as normal,
   *   but with these notable exceptions:
   *
   *      - There is no payload data available with messages
   *      - An alert() is called when a notification is received unlesss you return false
   *        in your 'onNotification' callback.
   *
   */

  var PushDevService = (function () {
    function PushDevService() {
      _classCallCheck(this, PushDevService);

      this.logger = new Ionic.IO.Logger({
        'prefix': 'Ionic Push (dev):'
      });
      this._serviceHost = Settings.getURL('push');
      this._token = false;
      this._watch = false;
      this._emitter = Ionic.IO.Core.getEmitter();
    }

    /**
     * Generate a development token
     *
     * @return {String} development device token
     */

    _createClass(PushDevService, [{
      key: 'getDevToken',
      value: function getDevToken() {
        // Some crazy bit-twiddling to generate a random guid
        var token = 'DEV-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0,
              v = c === 'x' ? r : r & 0x3 | 0x8;
          return v.toString(16);
        });
        this._token = token;
        return this._token;
      }

      /**
       * Registers a development token with the Ionic Push service
       *
       * @param {IonicPushService} ionicPush Instantiated Push Service
       * @return {void}
       */
    }, {
      key: 'init',
      value: function init(ionicPush) {
        this._push = ionicPush;
        var token = this._token;
        var self = this;
        if (!token) {
          token = this.getDevToken();
        }

        var requestOptions = {
          "method": 'POST',
          "uri": this._serviceHost + '/dev/push',
          'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          "body": JSON.stringify({
            "dev_token": token
          })
        };

        new ApiRequest(requestOptions).then(function () {
          self.logger.info('registered with development push service', token);
          self._emitter.emit("ionic_push:token", { "token": token });
          if (self.registerCallback) {
            self.registerCallback({
              "registrationId": token
            });
          }
          self.watch();
        }, function (error) {
          self.logger.error("error connecting development push service.", error);
        });
      }

      /**
       * Checks the push service for notifications that target the current development token
       * @return {void}
       */
    }, {
      key: 'checkForNotifications',
      value: function checkForNotifications() {
        if (!this._token) {
          return false;
        }

        var self = this;
        var requestOptions = {
          'method': 'GET',
          'uri': this._serviceHost + '/dev/push/check',
          'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Ionic-Dev-Token': this._token
          },
          'json': true
        };

        new ApiRequest(requestOptions).then(function (result) {
          if (result.payload.messages.length > 0) {
            var notification = {
              'message': result.payload.messages[0],
              'title': 'DEVELOPMENT PUSH'
            };

            console.warn("Ionic Push: Development Push received. Development pushes will not contain payload data.");

            var callbackRet = self._push.notificationCallback && self._push.notificationCallback(notification);
            // If the custom handler returns false, don't handle this at all in our code
            if (callbackRet === false) {
              return;
            }

            // If the user callback did not return false, prompt an alert to show the notification
            alert(notification.message);
          }
        }, function (error) {
          self.logger.error("unable to check for development pushes.", error);
        });
      }

      /**
       * Kicks off the "polling" of the Ionic Push service for new push notifications
       * @return {void}
       */
    }, {
      key: 'watch',
      value: function watch() {
        // Check for new dev pushes every 5 seconds
        this.logger.info('watching for new notifications');
        var self = this;
        if (!this._watch) {
          this._watch = setInterval(function () {
            self.checkForNotifications();
          }, 5000);
        }
      }

      /**
       * Puts the "polling" for new notifications on hold.
       * @return {void}
       */
    }, {
      key: 'halt',
      value: function halt() {
        if (this._watch) {
          clearInterval(this._watch);
        }
      }
    }]);

    return PushDevService;
  })();

  Ionic.namespace('Ionic', 'PushDevService', PushDevService, window);
})();

},{}],3:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

(function () {
  var PushToken = (function () {
    function PushToken(token) {
      _classCallCheck(this, PushToken);

      this._token = token || null;
    }

    _createClass(PushToken, [{
      key: 'toString',
      value: function toString() {
        var token = this._token || 'null';
        return '<PushToken [\'' + token + '\']>';
      }
    }, {
      key: 'token',
      set: function set(value) {
        this._token = value;
      },
      get: function get() {
        return this._token;
      }
    }]);

    return PushToken;
  })();

  Ionic.namespace('Ionic', 'PushToken', PushToken, window);
})();

},{}],4:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

(function () {

  var IonicApp = Ionic.IO.App;
  var Token = Ionic.PushToken;
  var Settings = new Ionic.IO.Settings();
  var Core = Ionic.IO.Core;

  /**
   * Push Service
   *
   * This is the main entrypoint for interacting with the Ionic Push service.
   * Example Usage:
   *
   *   Ionic.io(); // kick off the io platform
   *   var push = new Ionic.Push({
   *     "debug": true,
   *     "onNotification": function(notification) {
   *       var payload = $ionicPush.getPayload(notification);
   *       console.log(notification, payload);
   *     },
   *     "onRegister": function(data) {
   *       console.log(data);
   *     }
   *   });
   *
   *   // Registers for a device token using the options passed to init()
   *   push.register(callback);
   *
   *   // Unregister the current registered token
   *   push.unregister();
   *
   */

  var Push = (function () {
    function Push(config) {
      _classCallCheck(this, Push);

      this.logger = new Ionic.IO.Logger({
        'prefix': 'Ionic Push:'
      });

      var App = new IonicApp(Settings.get('app_id'), Settings.get('api_key'));
      App.devPush = Settings.get('dev_push');
      App.gcmKey = Settings.get('gcm_key');

      // Check for the required values to use this service
      if (!App.id || !App.apiKey) {
        this.logger.error('no app_id or api_key found. (http://docs.ionic.io/docs/io-install)');
        return false;
      } else if (Core.isAndroidDevice() && !App.devPush && !App.gcmKey) {
        this.logger.error('GCM project number not found (http://docs.ionic.io/docs/push-android-setup)');
        return false;
      }

      this.app = App;
      this.registerCallback = false;
      this.notificationCallback = false;
      this.errorCallback = false;
      this._token = false;
      this._notification = false;
      this._debug = false;
      this._isReady = false;
      this._tokenReady = false;
      this._blockRegistration = false;
      this._emitter = Core.getEmitter();
      this.init(config);
    }

    /**
     * Init method to setup push behavior/options
     *
     * The config supports the following properties:
     *   - debug {Boolean} Enables some extra logging as well as some default callback handlers
     *   - onNotification {Function} Callback function that is passed the notification object
     *   - onRegister {Function} Callback function that is passed the registration object
     *   - onError {Function} Callback function that is passed the error object
     *   - pluginConfig {Object} Plugin configuration: https://github.com/phonegap/phonegap-plugin-push
     *
     * @param {object} config Configuration object
     * @return {Push} returns the called Push instantiation
     */

    _createClass(Push, [{
      key: 'init',
      value: function init(config) {
        var PushPlugin = this._getPushPlugin();
        if (!PushPlugin) {
          return false;
        }
        if (typeof config === 'undefined') {
          config = {};
        }
        if (typeof config !== 'object') {
          this.logger.error('init() requires a valid config object.');
          return false;
        }
        var self = this;

        if (!config.pluginConfig) {
          config.pluginConfig = {};
        }

        if (Core.isAndroidDevice()) {
          // inject gcm key for PushPlugin
          if (!config.pluginConfig.android) {
            config.pluginConfig.android = {};
          }
          if (!config.pluginConfig.android.senderId) {
            config.pluginConfig.android.senderID = self.app.gcmKey;
          }
        }

        // Store Callbacks
        if (config.onRegister) {
          this.setRegisterCallback(config.onRegister);
        }
        if (config.onNotification) {
          this.setNotificationCallback(config.onNotification);
        }
        if (config.onError) {
          this.setErrorCallback(config.onError);
        }

        this._config = JSON.parse(JSON.stringify(config));
        this._isReady = true;

        this._emitter.emit('ionic_push:ready', { "config": this._config });
        return this;
      }

      /**
       * Store the currently registered device token with a User
       *
       * @param {IonicUser} user The User the token should be associated with
       * @return {void}
       */
    }, {
      key: 'addTokenToUser',
      value: function addTokenToUser(user) {
        if (!this._token) {
          this.logger.info('a token must be registered before you can add it to a user.');
        }
        if (typeof user === 'object') {
          if (Core.isAndroidDevice()) {
            user.addPushToken(this._token, 'android');
          } else if (Core.isIOSDevice()) {
            user.addPushToken(this._token, 'ios');
          } else {
            this.logger.info('token is not a valid Android or iOS registration id. Cannot save to user.');
          }
        } else {
          this.logger.info('invalid $ionicUser object passed to $ionicPush.addToUser()');
        }
      }

      /**
       * Registers the device with GCM/APNS to get a device token
       * Fires off the 'onRegister' callback if one has been provided in the init() config
       * @param {function} callback Callback Function
       * @return {void}
       */
    }, {
      key: 'register',
      value: function register(callback) {
        var self = this;
        if (this._blockRegistration) {
          self.logger.info("another registration is already in progress.");
          return false;
        }
        this._blockRegistration = true;
        this.onReady(function () {
          if (self.app.devPush) {
            var IonicDevPush = new Ionic.PushDevService();
            IonicDevPush.init(self);
            self._blockRegistration = false;
            self._tokenReady = true;
          } else {
            self._plugin = PushNotification.init(self._config.pluginConfig);
            self._plugin.on('registration', function (data) {
              self._blockRegistration = false;
              self._token = new Token(data.registrationId);
              self._tokenReady = true;
              if (typeof callback === 'function') {
                callback(self._token);
              }
            });
            self._debugCallbackRegistration();
            self._callbackRegistration();
          }
        });
      }

      /**
       * Invalidate the current GCM/APNS token
       *
       * @param {function} callback Success Callback
       * @param {function} errorCallback Error Callback
       * @return {mixed} plugin unregister response
       */
    }, {
      key: 'unregister',
      value: function unregister(callback, errorCallback) {
        if (!this._plugin) {
          return false;
        }
        return this._plugin.unregister(callback, errorCallback);
      }

      /**
       * Convenience method to grab the payload object from a notification
       *
       * @param {PushNotification} notification Push Notification object
       * @return {object} Payload object or an empty object
       */
    }, {
      key: 'getPayload',
      value: function getPayload(notification) {
        var payload = {};
        if (typeof notification === 'object') {
          if (notification.additionalData && notification.additionalData.payload) {
            payload = notification.additionalData.payload;
          }
        }
        return payload;
      }

      /**
       * Set the registration callback
       *
       * @param {function} callback Registration callback function
       * @return {boolean} true if set correctly, otherwise false
       */
    }, {
      key: 'setRegisterCallback',
      value: function setRegisterCallback(callback) {
        if (typeof callback !== 'function') {
          this.logger.info('setRegisterCallback() requires a valid callback function');
          return false;
        }
        this.registerCallback = callback;
        return true;
      }

      /**
       * Set the notification callback
       *
       * @param {function} callback Notification callback function
       * @return {boolean} true if set correctly, otherwise false
       */
    }, {
      key: 'setNotificationCallback',
      value: function setNotificationCallback(callback) {
        if (typeof callback !== 'function') {
          this.logger.info('setNotificationCallback() requires a valid callback function');
          return false;
        }
        this.notificationCallback = callback;
        return true;
      }

      /**
       * Set the error callback
       *
       * @param {function} callback Error callback function
       * @return {boolean} true if set correctly, otherwise false
       */
    }, {
      key: 'setErrorCallback',
      value: function setErrorCallback(callback) {
        if (typeof callback !== 'function') {
          this.logger.info('setErrorCallback() requires a valid callback function');
          return false;
        }
        this.errorCallback = callback;
        return true;
      }

      /**
       * Registers the default debug callbacks with the PushPlugin when debug is enabled
       * Internal Method
       * @private
       * @return {void}
       */
    }, {
      key: '_debugCallbackRegistration',
      value: function _debugCallbackRegistration() {
        var self = this;
        if (this._config.debug) {
          this._plugin.on('registration', function (data) {
            self._token = new Token(data.registrationId);
            self.logger.info('device token registered', self._token);
          });

          this._plugin.on('notification', function (notification) {
            self._processNotification(notification);
            self.logger.info('notification received', self._notification);
          });

          this._plugin.on('error', function (err) {
            self.logger.error('unexpected error occured.');
            self.logger.error(err);
          });
        }
      }

      /**
       * Registers the user supplied callbacks with the PushPlugin
       * Internal Method
       * @return {void}
       */
    }, {
      key: '_callbackRegistration',
      value: function _callbackRegistration() {
        var self = this;
        this._plugin.on('registration', function (data) {
          self._token = new Token(data.registrationId);
          if (self.registerCallback) {
            return self.registerCallback(data);
          }
        });

        this._plugin.on('notification', function (notification) {
          self._processNotification(notification);
          if (self.notificationCallback) {
            return self.notificationCallback(notification);
          }
        });

        this._plugin.on('error', function () {
          if (self.errorCallback) {
            return self.errorCallback();
          }
        });
      }

      /**
       * Performs misc features based on the contents of a push notification
       * Internal Method
       *
       * Currently just does the payload $state redirection
       * @param {PushNotification} notification Push Notification object
       * @return {void}
       */
    }, {
      key: '_processNotification',
      value: function _processNotification(notification) {
        this._notification = notification;
        this._emitter.emit('ionic_push:processNotification', notification);
      }

      /**
       * Fetch the phonegap-push-plugin interface
       * Internal Method
       *
       * @return {PushNotification} PushNotification instance
       */
    }, {
      key: '_getPushPlugin',
      value: function _getPushPlugin() {
        var PushPlugin = false;
        try {
          PushPlugin = window.PushNotification;
        } catch (e) {
          this.logger.info('something went wrong looking for the PushNotification plugin');
        }

        if (!PushPlugin && (Core.isIOSDevice() || Core.isAndroidDevice())) {
          self.logger.error("PushNotification plugin is required. Have you run `ionic plugin add phonegap-plugin-push` ?");
        }
        return PushPlugin;
      }

      /**
       * Fire a callback when Push is ready. This will fire immediately if
       * the service has already initialized.
       *
       * @param {function} callback Callback function to fire off
       * @return {void}
       */
    }, {
      key: 'onReady',
      value: function onReady(callback) {
        var self = this;
        if (this._isReady) {
          callback(self);
        } else {
          self._emitter.on('ionic_push:ready', function () {
            callback(self);
          });
        }
      }
    }]);

    return Push;
  })();

  Ionic.namespace('Ionic', 'Push', Push, window);
})();

},{}]},{},[3,2,4,1]);
