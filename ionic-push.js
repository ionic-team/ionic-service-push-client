/**
 * Ionic Push Module
 * Copyright 2015 Ionic http://ionicframework.com/
 * See LICENSE in this repository for license information
 */

(function() {
  angular.module('ionic.service.push', ['ionic.service.core'])

  /**
   * IonicPush Service
   * 
   * This is the main entrypoint for interacting with the Ionic Push service.
   * Example Usage:
   *
   *   $ionicPush.init({
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
   *   $ionicPush.register(successCallback, errorCallback);
   * 
   *   // Unregister the current registered token
   *   $ionicPush.unregister();
   *
   */
  .factory('$ionicPush', ['$window', '$http', '$ionicPushAction', '$ionicUser', '$ionicCoreSettings', '$ionicDevPush', '$rootScope',

    function($window, $http, $ionicPushAction, $ionicUser, $ionicCoreSettings, $ionicDevPush, $rootScope) {

      // Setup the app configuration
      var app = {
        'id': $ionicCoreSettings.get('app_id'),
        'api_key': $ionicCoreSettings.get('api_key'),
        'dev_push': $ionicCoreSettings.get('dev_push') || false,
        'gcm_key': $ionicCoreSettings.get('gcm_key') || false
      };

      // Check for the required values to use this service
      if(!app.id || !app.api_key) {
        console.error('Ionic Push: No app_id or api_key found. (http://docs.ionic.io/docs/io-install)');
        return false;
      } else if(ionic.Platform.isAndroid() && !app.dev_push && !app.gcm_key) {
        console.error('Ionic Push: GCM project number not found (http://docs.ionic.io/docs/push-android-setup)');
        return false;
      }

      var IonicPushService = function(app) {
        this.app = app;
        this.registerCallback = false;
        this.notificationCallback = false;
        this.errorCallback = false;
        this._token = false;
        this._notification = false;
        this._debug = false;
        this._isReady = false;
        this._tokenReady = false;
        this._blockRegistration = false;
      };
      var IonicPush = IonicPushService.prototype;

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
      IonicPush.init = function(config) {
        var PushPlugin = this._getPushPlugin();
        if(!PushPlugin) { return false; }
        if(typeof config === 'undefined') { config = {}; }
        if(typeof config !== 'object') {
          console.error('Ionic Push: $ionicPush.init() requires a valid config object.')
          return false;
        }
        var self = this;

        if(!config.pluginConfig) { config.pluginConfig = {}; }

        if(ionic.Platform.isAndroid()) {
          // inject gcm key for PushPlugin
          if(!config.pluginConfig.android) { config.pluginConfig.android = {}; }
          if(!config.pluginConfig.android.senderId) { config.pluginConfig.android.senderID = self.app.gcm_key; }
        }

        // Store Callbacks
        if(config.onRegister) { this.setRegisterCallback(config.onRegister); }
        if(config.onNotification) { this.setNotificationCallback(config.onNotification); }
        if(config.onError) { this.setErrorCallback(config.onError); }

        this._config = angular.copy(config);
        this._isReady = true;

        $rootScope.$emit('$ionicPush:ready', { config: this._config });
        return this;
      };

      /**
       * Store the currently registered device token with a User
       *
       * @param {IonicUser} The User the token should be associated with
       */
      IonicPush.addTokenToUser = function(user) {
        if(!this._token) {
          console.log('Ionic Push: A token must be registered before you can add it to a user.');
        }
        if(typeof user === 'object') {
          if(ionic.Platform.isAndroid()) {
            user.addPushToken(this._token, 'android');
          } else if(ionic.Platform.isIOS()) {
            user.addPushToken(this._token, 'ios');
          } else {
            console.log('Ionic Push: Token is not a valid Android or iOS registration id. Cannot save to user.');
          }
        } else {
          console.log('Ionic Push: Invalid $ionicUser object passed to $ionicPush.addToUser()');
        }
      };

      /**
       * Registers the device with GCM/APNS to get a device token
       * Fires off the 'onRegister' callback if one has been provided in the init() config
       */
      IonicPush.register = function() {
        var self = this;
        if(this._blockRegistration) {
          console.log("Ionic Push: Another registration is already in progress.");
          return false;
        }
        this._blockRegistration = true;
        this.onReady(function() {
          if(self.app.dev_push) {
            $ionicDevPush.init(self);
            this._blockRegistration = false;
            self._tokenReady = true;
          } else {
            self._plugin = PushNotification.init(self._config.pluginConfig);
            self._plugin.on('registration', function(data) {
              self._blockRegistration = false;
              self._token = data.registrationId;
              self._tokenReady = true;
              $rootScope.$emit("$ionicPush:tokenReceived", { "token": data.registrationId });
            });
            self._debugCallbackRegistration();
            self._callbackRegistration();
          }
        });
      };

      /**
       * Invalidate the current GCM/APNS token
       *
       * @param {Function} Success Callback
       * @param {Function} Error Callback
       */
      IonicPush.unregister = function(callback, errorCallback) {
        if(!this._plugin) { return false; }
        return this._plugin.unregister(callback, errorCallback);
      };

      /**
       * Convenience method to grab the payload object from a notification
       *
       * @return {Object} Payload object or an empty object
       */
      IonicPush.getPayload = function(notification) {
        var payload = {};
        if(typeof notification === 'object') {
          if(notification.additionalData && notification.additionalData.payload) {
            payload = notification.additionalData.payload;
          }
        }
        return payload;
      };

      /**
       * Set the registration callback
       *
       * @return {Boolean} true if set correctly, otherwise false
       */
      IonicPush.setRegisterCallback = function(callback) {
        if(typeof callback !== 'function') {
          console.log('Ionic Push: setRegisterCallback() requires a valid callback function');
          return false;
        }
        this.registerCallback = callback;
        return true;
      };

      /**
       * Set the notification callback
       *
       * @return {Boolean} true if set correctly, otherwise false
       */
      IonicPush.setNotificationCallback = function(callback) {
        if(typeof callback !== 'function') {
          console.log('Ionic Push: setNotificationCallback() requires a valid callback function');
          return false;
        }
        this.notificationCallback = callback;
        return true;
      };

      /**
       * Set the error callback
       *
       * @return {Boolean} true if set correctly, otherwise false
       */
      IonicPush.setErrorCallback = function(callback) {
        if(typeof callback !== 'function') {
          console.log('Ionic Push: setErrorCallback() requires a valid callback function');
          return false;
        }
        this.errorCallback = callback;
        return true;
      };

      /**
       * Registers the default debug callbacks with the PushPlugin when debug is enabled
       * Internal Method
       */
      IonicPush._debugCallbackRegistration = function() {
        var self = this;
        if(this._config.debug) {
          this._plugin.on('registration', function(data) {
            self._token = data.registrationId;
            console.log('[DEBUG] Ionic Push: Device token registered', self._token);
          });

          this._plugin.on('notification', function(notification) {
            self._processNotification(notification);
            console.log('[DEBUG] Ionic Push: Notification Received', self._notification);
          });

          this._plugin.on('error', function(err) {
            console.log('[DEBUG] Ionic Push: Unexpected error occured.');
            console.log(err);
          });
        }
      };

      /**
       * Registers the user supplied callbacks with the PushPlugin
       * Internal Method
       */
      IonicPush._callbackRegistration = function() {
        var self = this;
        this._plugin.on('registration', function(data) {
          self._token = data.registrationId;
          if(self.registerCallback) {
            return self.registerCallback(data);
          }
        });

        this._plugin.on('notification', function(notification) {
          self._processNotification(notification);
          if(self.notificationCallback) {
            return self.notificationCallback(notification);
          }
        });

        this._plugin.on('error', function(e) {
          if(self.errorCallback) {
            return self.errorCallback();
          }
        });
      };

      /**
       * Performs misc features based on the contents of a push notification
       * Internal Method
       *
       * Currently just does the payload $state redirection
       *
       */
      IonicPush._processNotification = function(notification) {
        this._notification = notification;
        if(notification.additionalData.foreground === false) {
          $ionicPushAction.notificationNavigation(notification);
        }
      };

      /**
       * Fetch the phonegap-push-plugin interface
       * Internal Method
       *
       * @return {PushNotification} PushNotification instance
       */
      IonicPush._getPushPlugin = function() {
        var PushPlugin = false;
        try {
          PushPlugin = $window.PushNotification;
        } catch(e) {
          console.log('Ionic Push: Something went wrong looking for the PushNotification plugin');
        }

        if(!PushPlugin && (ionic.Platform.isIOS() || ionic.Platform.isAndroid()) ) {
          console.error("PushNotification plugin is required. Have you run `ionic plugin add phonegap-plugin-push` ?");
        }
        return PushPlugin;
      };

      if(!$rootScope.$ionicPush) {
        $rootScope.$__ionicPush = new IonicPushService(app);
      }

      IonicPush.onReady = function(callback) {
        var self = this;
        if(this._isReady) {
          callback(self);
        } else {
          $rootScope.$on('$ionicPush:ready', function(event, data) {
            callback(self);
          });
        }
      };

      IonicPush.onToken = function(callback) {
        var self = this;
        if(self._tokenReady) {
          callback({ 'token': self._token });
        } else {
          $rootScope.$on('$ionicPush:tokenReceived', function(event, data) {
            callback({ 'token': data.token });
          });
        }
      };

      return $rootScope.$__ionicPush;

  }]);

})();

(function() {

  angular.module('ionic.service.push')

  /**
   * IonicDevPush Service
   * 
   * This service acts as a mock push service that is intended to be used pre-setup of
   * GCM/APNS in an Ionic.io project.
   * 
   * How it works:
   *  
   *   When $ionicPush.register is called, this service is used to generate a random
   *   development device token. This token is not valid for any service outside of
   *   Ionic Push with `dev_push` set to true. These tokens do not last long and are not
   *   eligible for use in a production app.
   *   
   *   The device will then periodically check the Push service for push notifications sent
   *   to our development token -- so unlike a typical "push" update, this actually uses
   *   "polling" to find new notifications. This means you *MUST* have the application open
   *   and in the foreground to retreive messsages. 
   *
   *   The callbacks provided in your $ionicPush.init() will still be triggered as normal,
   *   but with these notable exceptions:
   *
   *      - There is no payload data available with messages
   *      - An alert() is called when a notification is received unlesss you return false
   *        in your 'onNotification' callback.
   *
   */
  .factory('$ionicDevPush', ['$rootScope', '$http', '$ionicApp', function($rootScope, $http, $ionicApp) {

    var IonicDevPushService = function(){
      this._service_host = $ionicApp.getValue('push_api_server'),
      this._token = false;
      this._watch = false;
    };
    var IonicDevPush = IonicDevPushService.prototype;


    /**
     * Generate a development token
     *
     * @return {String} development device token
     */
    IonicDevPush.getDevToken = function() {
      // Some crazy bit-twiddling to generate a random guid
      var token = 'DEV-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
      this._token = token;
      return this._token;
    };


    /**
     * Registers a development token with the Ionic Push service
     *
     * @param {IonicPushService} Instantiated $ionicPush service
     */
    IonicDevPush.init = function(ionicPush) {
      this._push = ionicPush;
      var url = this._service_host + '/dev/push';
      var token = this._token;
      var self = this;
      if(!token) {
        token = this.getDevToken();
      }

      var req = {
        method: 'POST',
        url: url,
        data: {
          "dev_token": token
        }
      };

      $http(req).success(function(resp) {
        console.log('Ionic Push: Registered with development push service', token);
        $rootScope.$emit("$ionicPush:tokenReceived", { "token": token });
        if(self.registerCallback) {
          self.registerCallback({
            registrationId: token
          });
        }
        self.watch();
      }).error(function(error) {
        console.log("Ionic Push: Error connecting development push service.", error);
      });
    };

    /**
     * Checks the push service for notifications that target the current development token
     */
    IonicDevPush.checkForNotifications = function() {
      if(!this._token) {
        return false;
      }

      var self = this;
      var url = this._service_host + '/dev/push/check';
      var checkReq = {
        method: 'GET',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          'X-Ionic-Dev-Token': this._token
        }
      }; 

      $http(checkReq).success(function(resp){
        if (resp.messages.length > 0) {
          console.log(resp);
          var notification = {
            'message': resp.messages[0],
            'title': 'DEVELOPMENT PUSH'
          };
          
          console.warn("Ionic Push: Development Push received. Development pushes will not contain payload data.");

          var callbackRet = self._push.notificationCallback && self._push.notificationCallback(notification);
          // If the custom handler returns false, don't handle this at all in our code
          if(callbackRet === false) {
            return;
          }
          
          // If the user callback did not return false, prompt an alert to show the notification
          alert(notification.message);
        }
      }).error(function(error){
        console.log("Ionic Push: Unable to check for development pushes.", error);
      });
    };

    /**
     * Kicks off the "polling" of the Ionic Push service for new push notifications
     */
    IonicDevPush.watch = function() {
      // Check for new dev pushes every 5 seconds
      console.log('Ionic Push: Watching for new notifications');
      var self = this;
      if(!this._watch) {
        this._watch = setInterval(function() { self.checkForNotifications() }, 5000);
      }
    };

    /**
     * Puts the "polling" for new notifications on hold.
     */
    IonicDevPush.halt = function() {
      if(this._watch) {
        clearInterval(this._watch);
      }
    };

    return new IonicDevPushService();

  }]);

})();

(function() {
  angular.module('ionic.service.push')

  /**
   * IonicPushAction Service
   * 
   * A utility service to kick off misc features as part of the Ionic Push service
   */
  .factory('$ionicPushAction', ['$rootElement', '$injector', function($rootElement, $injector) {

    var IonicPushActionService = function(){};
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
    IonicPushAction.notificationNavigation = function(notification) {
      var state = false;
      var stateParams = {};
      var injector = $rootElement.injector();
      
      try {
        state = notification.additionalData.payload.$state;
      } catch(e) {}

      try {
        stateParams = JSON.parse(notification.additionalData.payload.$stateParams);
      } catch(e) {}

      if (state) {
        $state = injector.get('$state');
        $state.go(state, stateParams);
      }
    };

    return new IonicPushActionService();
  }]);

})();
