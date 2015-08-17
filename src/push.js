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
            $ionicUser.push('_push.android_tokens', this._token, true);
          } else if(ionic.Platform.isIOS()) {
            $ionicUser.push('_push.ios_tokens', this._token, true);
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
        if(this.app.dev_push) {
          $ionicDevPush.init(this);
        } else {
          this._plugin = PushNotification.init(this._config.pluginConfig);
          this._debugCallbackRegistration();
          this._callbackRegistration();
        }
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
          $rootScope.$on('$ionicPush:ready', function(data) {
            callback(self);
          });
        }
      };

      return $rootScope.$__ionicPush;

  }]);

})();
