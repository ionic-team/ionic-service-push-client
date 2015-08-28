(function() {

  var IonicApp = ionic.io.core.App;
  var Token = ionic.io.push.Token;
  var Settings = new ionic.io.core.Settings();

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
  class PushService {
    constructor() {

      var App = new IonicApp(Settings.get('app_id'), Settings.get('api_key'));
      App.devPush = Settings.get('dev_push');
      App.gcmKey = Settings.get('gcm_key');

      // Check for the required values to use this service
      if(!App.id || !App.apiKey) {
        console.error('Ionic Push: No app_id or api_key found. (http://docs.ionic.io/docs/io-install)');
        return false;
      } else if(ionic.Platform.isAndroid() && !App.devPush && !App.gcmKey) {
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
      this._emitter = ionic.io.core.main.events;
    };

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
    init(config) {
      var PushPlugin = this._getPushPlugin();
      if(!PushPlugin) { return false; }
      if(typeof config === 'undefined') { config = {}; }
      if(typeof config !== 'object') {
        console.error('Ionic Push: init() requires a valid config object.')
        return false;
      }
      var self = this;

      if(!config.pluginConfig) { config.pluginConfig = {}; }

      if(ionic.Platform.isAndroid()) {
        // inject gcm key for PushPlugin
        if(!config.pluginConfig.android) { config.pluginConfig.android = {}; }
        if(!config.pluginConfig.android.senderId) { config.pluginConfig.android.senderID = self.app.gcmKey; }
      }

      // Store Callbacks
      if(config.onRegister) { this.setRegisterCallback(config.onRegister); }
      if(config.onNotification) { this.setNotificationCallback(config.onNotification); }
      if(config.onError) { this.setErrorCallback(config.onError); }

      this._config = JSON.parse(JSON.stringify(config));
      this._isReady = true;

      this._emitter.emit('ionic_push:ready', { config: this._config });
      return this;
    };

    /**
     * Store the currently registered device token with a User
     *
     * @param {IonicUser} The User the token should be associated with
     */
    addTokenToUser(user) {
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
    register(callback) {
      var self = this;
      if(this._blockRegistration) {
        console.log("Ionic Push: Another registration is already in progress.");
        return false;
      }
      this._blockRegistration = true;
      this.onReady(function() {
        if(self.app.devPush) {
          var IonicDevPush = new ionic.io.push.PushDevService();
          IonicDevPush.init(self);
          self._blockRegistration = false;
          self._tokenReady = true;
        } else {
          self._plugin = PushNotification.init(self._config.pluginConfig);
          self._plugin.on('registration', function(data) {
            self._blockRegistration = false;
            self._token = new Token(data.registrationId);
            self._tokenReady = true;
            if((typeof callback === 'function')) {
              callback(self._token);
            }
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
    unregister(callback, errorCallback) {
      if(!this._plugin) { return false; }
      return this._plugin.unregister(callback, errorCallback);
    };

    /**
     * Convenience method to grab the payload object from a notification
     *
     * @return {Object} Payload object or an empty object
     */
    getPayload(notification) {
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
    setRegisterCallback(callback) {
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
    setNotificationCallback(callback) {
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
    setErrorCallback(callback) {
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
    _debugCallbackRegistration() {
      var self = this;
      if(this._config.debug) {
        this._plugin.on('registration', function(data) {
          self._token = new Token(data.registrationId);
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
    _callbackRegistration() {
      var self = this;
      this._plugin.on('registration', function(data) {
        self._token = new Token(data.registrationId);
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
    _processNotification(notification) {
      this._notification = notification;
      this._emitter.emit('ionic_push:processNotification', notification);
    };

    /**
     * Fetch the phonegap-push-plugin interface
     * Internal Method
     *
     * @return {PushNotification} PushNotification instance
     */
    _getPushPlugin() {
      var PushPlugin = false;
      try {
        PushPlugin = window.PushNotification;
      } catch(e) {
        console.log('Ionic Push: Something went wrong looking for the PushNotification plugin');
      }

      if(!PushPlugin && (ionic.Platform.isIOS() || ionic.Platform.isAndroid()) ) {
        console.error("PushNotification plugin is required. Have you run `ionic plugin add phonegap-plugin-push` ?");
      }
      return PushPlugin;
    };

    /**
     * Fire a callback when the PushService is ready. This will fire immediately if
     * the service has already initialized.
     *
     * @param {Function} Callback function to fire off
     */
    onReady(callback) {
      var self = this;
      if(this._isReady) {
        callback(self);
      } else {
        self._emitter.on('ionic_push:ready', function(event, data) {
          callback(self);
        });
      }
    };

  };


  ionic.io.register('push');
  ionic.io.push.PushService = PushService;

})();
