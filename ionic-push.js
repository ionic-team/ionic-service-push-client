(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Add Angular integrations if Angular is available
'use strict';

if (typeof angular === 'object' && angular.module) {
  angular.module('ionic.service.push', [])

  /**
   * IonicPushAction Service
   * 
   * A utility service to kick off misc features as part of the Ionic Push service
   */
  .factory('$ionicPushAction', ['$state', function ($state) {

    var IonicPushActionService = function IonicPushActionService() {};
    var IonicPushAction = IonicPushActionService.prototype;

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
     */
    IonicPushAction.notificationNavigation = function (notification) {
      var state = false;
      var stateParams = {};

      try {
        state = notification.additionalData.payload.$state;
      } catch (e) {}

      try {
        stateParams = JSON.parse(notification.additionalData.payload.$stateParams);
      } catch (e) {}

      if (state) {
        $state.go(state, stateParams);
      }
    };

    return new IonicPushActionService();
  }]).factory('$ionicPushUtil', [function () {
    return {
      'Token': ionic.io.push.Token
    };
  }]).factory('$ionicDevPush', [function () {
    return new ionic.io.push.DevService();
  }]).factory('$ionicPush', [function () {
    return ionic.io.singleton.PushService;
  }]).run(function ($ionicPushAction) {

    // This is what kicks off the state redirection when a push notificaiton has the relevant details
    ionic.io.singleton.Events.on('ionic_push:processNotification', function (notification) {
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

  var ApiRequest = ionic.io.base.ApiRequest;

  /**
   * IonicDevPush Service
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

  var IonicDevPushService = (function () {
    function IonicDevPushService() {
      _classCallCheck(this, IonicDevPushService);

      this._service_host = ionic.io.singleton.Settings.getURL('push'), this._token = false;
      this._watch = false;
      this._emitter = ionic.io.singleton.Events;
    }

    _createClass(IonicDevPushService, [{
      key: 'getDevToken',

      /**
       * Generate a development token
       *
       * @return {String} development device token
       */
      value: function getDevToken() {
        // Some crazy bit-twiddling to generate a random guid
        var token = 'DEV-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0,
              v = c == 'x' ? r : r & 0x3 | 0x8;
          return v.toString(16);
        });
        this._token = token;
        return this._token;
      }
    }, {
      key: 'init',

      /**
       * Registers a development token with the Ionic Push service
       *
       * @param {IonicPushService} Instantiated Push Service
       */
      value: function init(ionicPush) {
        this._push = ionicPush;
        var token = this._token;
        var self = this;
        if (!token) {
          token = this.getDevToken();
        }

        var requestOptions = {
          method: 'POST',
          uri: this._service_host + '/dev/push',
          'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            "dev_token": token
          })
        };

        new ApiRequest(requestOptions).then(function (result) {
          console.log('Ionic Push: Registered with development push service', token);
          self._emitter.emit("ionic_push:token", { "token": token });
          if (self.registerCallback) {
            self.registerCallback({
              registrationId: token
            });
          }
          self.watch();
        }, function (error) {
          console.log("Ionic Push: Error connecting development push service.", error);
        });
      }
    }, {
      key: 'checkForNotifications',

      /**
       * Checks the push service for notifications that target the current development token
       */
      value: function checkForNotifications() {
        if (!this._token) {
          return false;
        }

        var self = this;
        var requestOptions = {
          'method': 'GET',
          'uri': this._service_host + '/dev/push/check',
          'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Ionic-Dev-Token': this._token
          },
          json: true
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
          console.log("Ionic Push: Unable to check for development pushes.", error);
        });
      }
    }, {
      key: 'watch',

      /**
       * Kicks off the "polling" of the Ionic Push service for new push notifications
       */
      value: function watch() {
        // Check for new dev pushes every 5 seconds
        console.log('Ionic Push: Watching for new notifications');
        var self = this;
        if (!this._watch) {
          this._watch = setInterval(function () {
            self.checkForNotifications();
          }, 5000);
        }
      }
    }, {
      key: 'halt',

      /**
       * Puts the "polling" for new notifications on hold.
       */
      value: function halt() {
        if (this._watch) {
          clearInterval(this._watch);
        }
      }
    }]);

    return IonicDevPushService;
  })();

  ;

  if (typeof ionic == 'undefined') {
    ionic = {};
  }
  if (typeof ionic.io == 'undefined') {
    ionic.io = {};
  }
  if (typeof ionic.io.push == 'undefined') {
    ionic.io.push = {};
  }

  ionic.io.push.PushDevService = IonicDevPushService;
})();

},{}],3:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

(function () {
  var IonicPushToken = (function () {
    function IonicPushToken(token) {
      _classCallCheck(this, IonicPushToken);

      this._token = token || null;
    }

    _createClass(IonicPushToken, [{
      key: 'toString',
      value: function toString() {
        var token = this._token || 'null';
        return '<IonicPushToken [\'' + token + '\']>';
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

    return IonicPushToken;
  })();

  ;

  if (typeof ionic == 'undefined') {
    ionic = {};
  }
  if (typeof ionic.io == 'undefined') {
    ionic.io = {};
  }
  if (typeof ionic.io.push == 'undefined') {
    ionic.io.push = {};
  }

  ionic.io.push.Token = IonicPushToken;
})();

},{}],4:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

(function () {

  var IonicApp = ionic.io.base.App;
  var Token = ionic.io.push.Token;
  var Settings = ionic.io.singleton.Settings;

  /**
   * IonicPush Service
   * 
   * This is the main entrypoint for interacting with the Ionic Push service.
   * Example Usage:
   *
   *   var io = ionic.io.core;
   *   var push = io.push;
   *
   *   push.init({
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

  var IonicPush = (function () {
    function IonicPush() {
      _classCallCheck(this, IonicPush);

      var App = new IonicApp(Settings.get('app_id'), Settings.get('api_key'));
      App.devPush = Settings.get('dev_push');
      App.gcmKey = Settings.get('gcm_key');

      // Check for the required values to use this service
      if (!App.id || !App.apiKey) {
        console.error('Ionic Push: No app_id or api_key found. (http://docs.ionic.io/docs/io-install)');
        return false;
      } else if (ionic.Platform.isAndroid() && !App.devPush && !App.gcmKey) {
        console.error('Ionic Push: GCM project number not found (http://docs.ionic.io/docs/push-android-setup)');
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
      this._emitter = ionic.io.singleton.Events;
    }

    _createClass(IonicPush, [{
      key: 'init',

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
       * @param {Config} Configuration data
       * @return {IonicPushService} returns the called IonicPushService instantiation
       */
      value: function init(config) {
        var PushPlugin = this._getPushPlugin();
        if (!PushPlugin) {
          return false;
        }
        if (typeof config === 'undefined') {
          config = {};
        }
        if (typeof config !== 'object') {
          console.error('Ionic Push: init() requires a valid config object.');
          return false;
        }
        var self = this;

        if (!config.pluginConfig) {
          config.pluginConfig = {};
        }

        if (ionic.Platform.isAndroid()) {
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

        this._emitter.emit('ionic_push:ready', { config: this._config });
        return this;
      }
    }, {
      key: 'addTokenToUser',

      /**
       * Store the currently registered device token with a User
       *
       * @param {IonicUser} The User the token should be associated with
       */
      value: function addTokenToUser(user) {
        if (!this._token) {
          console.log('Ionic Push: A token must be registered before you can add it to a user.');
        }
        if (typeof user === 'object') {
          if (ionic.Platform.isAndroid()) {
            user.addPushToken(this._token, 'android');
          } else if (ionic.Platform.isIOS()) {
            user.addPushToken(this._token, 'ios');
          } else {
            console.log('Ionic Push: Token is not a valid Android or iOS registration id. Cannot save to user.');
          }
        } else {
          console.log('Ionic Push: Invalid $ionicUser object passed to $ionicPush.addToUser()');
        }
      }
    }, {
      key: 'register',

      /**
       * Registers the device with GCM/APNS to get a device token
       * Fires off the 'onRegister' callback if one has been provided in the init() config
       */
      value: function register(callback) {
        var self = this;
        if (this._blockRegistration) {
          console.log("Ionic Push: Another registration is already in progress.");
          return false;
        }
        this._blockRegistration = true;
        this.onReady(function () {
          if (self.app.devPush) {
            var IonicDevPush = new ionic.io.push.PushDevService();
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
    }, {
      key: 'unregister',

      /**
       * Invalidate the current GCM/APNS token
       *
       * @param {Function} Success Callback
       * @param {Function} Error Callback
       */
      value: function unregister(callback, errorCallback) {
        if (!this._plugin) {
          return false;
        }
        return this._plugin.unregister(callback, errorCallback);
      }
    }, {
      key: 'getPayload',

      /**
       * Convenience method to grab the payload object from a notification
       *
       * @return {Object} Payload object or an empty object
       */
      value: function getPayload(notification) {
        var payload = {};
        if (typeof notification === 'object') {
          if (notification.additionalData && notification.additionalData.payload) {
            payload = notification.additionalData.payload;
          }
        }
        return payload;
      }
    }, {
      key: 'setRegisterCallback',

      /**
       * Set the registration callback
       *
       * @return {Boolean} true if set correctly, otherwise false
       */
      value: function setRegisterCallback(callback) {
        if (typeof callback !== 'function') {
          console.log('Ionic Push: setRegisterCallback() requires a valid callback function');
          return false;
        }
        this.registerCallback = callback;
        return true;
      }
    }, {
      key: 'setNotificationCallback',

      /**
       * Set the notification callback
       *
       * @return {Boolean} true if set correctly, otherwise false
       */
      value: function setNotificationCallback(callback) {
        if (typeof callback !== 'function') {
          console.log('Ionic Push: setNotificationCallback() requires a valid callback function');
          return false;
        }
        this.notificationCallback = callback;
        return true;
      }
    }, {
      key: 'setErrorCallback',

      /**
       * Set the error callback
       *
       * @return {Boolean} true if set correctly, otherwise false
       */
      value: function setErrorCallback(callback) {
        if (typeof callback !== 'function') {
          console.log('Ionic Push: setErrorCallback() requires a valid callback function');
          return false;
        }
        this.errorCallback = callback;
        return true;
      }
    }, {
      key: '_debugCallbackRegistration',

      /**
       * Registers the default debug callbacks with the PushPlugin when debug is enabled
       * Internal Method
       */
      value: function _debugCallbackRegistration() {
        var self = this;
        if (this._config.debug) {
          this._plugin.on('registration', function (data) {
            self._token = new Token(data.registrationId);
            console.log('[DEBUG] Ionic Push: Device token registered', self._token);
          });

          this._plugin.on('notification', function (notification) {
            self._processNotification(notification);
            console.log('[DEBUG] Ionic Push: Notification Received', self._notification);
          });

          this._plugin.on('error', function (err) {
            console.log('[DEBUG] Ionic Push: Unexpected error occured.');
            console.log(err);
          });
        }
      }
    }, {
      key: '_callbackRegistration',

      /**
       * Registers the user supplied callbacks with the PushPlugin
       * Internal Method
       */
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

        this._plugin.on('error', function (e) {
          if (self.errorCallback) {
            return self.errorCallback();
          }
        });
      }
    }, {
      key: '_processNotification',

      /**
       * Performs misc features based on the contents of a push notification
       * Internal Method
       *
       * Currently just does the payload $state redirection
       *
       */
      value: function _processNotification(notification) {
        this._notification = notification;
        this._emitter.emit('ionic_push:processNotification', notification);
      }
    }, {
      key: '_getPushPlugin',

      /**
       * Fetch the phonegap-push-plugin interface
       * Internal Method
       *
       * @return {PushNotification} PushNotification instance
       */
      value: function _getPushPlugin() {
        var PushPlugin = false;
        try {
          PushPlugin = window.PushNotification;
        } catch (e) {
          console.log('Ionic Push: Something went wrong looking for the PushNotification plugin');
        }

        if (!PushPlugin && (ionic.Platform.isIOS() || ionic.Platform.isAndroid())) {
          console.error("PushNotification plugin is required. Have you run `ionic plugin add phonegap-plugin-push` ?");
        }
        return PushPlugin;
      }
    }, {
      key: 'onReady',

      /**
       * Fire a callback when the PushService is ready. This will fire immediately if
       * the service has already initialized.
       *
       * @param {Function} Callback function to fire off
       */
      value: function onReady(callback) {
        var self = this;
        if (this._isReady) {
          callback(self);
        } else {
          self._emitter.on('ionic_push:ready', function (event, data) {
            callback(self);
          });
        }
      }
    }]);

    return IonicPush;
  })();

  ;

  if (typeof ionic == 'undefined') {
    ionic = {};
  }
  if (typeof ionic.io == 'undefined') {
    ionic.io = {};
  }
  if (typeof ionic.io.push == 'undefined') {
    ionic.io.push = {};
  }
  if (typeof ionic.io.singleton == 'undefined') {
    ionic.io.singleton = {};
  }

  ionic.io.singleton.PushService = new IonicPush();
})();

},{}]},{},[3,2,4,1]);
