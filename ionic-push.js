angular.module('ionic.service.push', ['ionic.service.core'])

/**
 * The Ionic Push service client wrapper.
 *
 * Example:
 *
 * angular.controller(['$scope', '$ionicPush', function($scope, $ionicPush) {
 * }])
 *
 */
.factory('$ionicPush', ['$window', '$http', '$ionicPushAction', '$ionicUser', '$ionicCoreSettings', '$ionicDevPush', '$rootScope', '$log', '$q',

function($window, $http, $ionicPushAction, $ionicUser, $ionicCoreSettings, $ionicDevPush, $rootScope, $log, $q) {

  // Setup the app details
  var app = {
    'id': $ionicCoreSettings.get('app_id'),
    'api_key': $ionicCoreSettings.get('api_key'),
    'dev_push': $ionicCoreSettings.get('dev_push') || false
  };

  if($ionicCoreSettings.get('gcm_key')) {
    app.gcm_key = $ionicCoreSettings.get('gcm_key');
  }

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
    this._defer = false;
    this._token = false;
    this._notification = false;
  };
  var IonicPush = IonicPushService.prototype;

  IonicPush.init = function(config) {
    var PushPlugin = this.getPlugin();
    if(!PushPlugin) { return false; }
    if(typeof config !== 'object') {
      console.error('Ionic Push: $ionicPush.init() requires a valid config object.')
      return false;
    }
    var self = this;

    // set the gcm key
    if(ionic.Platform.isAndroid()) {
      if(!config.android) { config.android = {}; }
      if(!config.android.senderId) { config.android.senderID = self.app.gcm_key; }
    }
    
    this._config = angular.copy(config);

    this._defer = $q.defer();

    if(self.app.dev_push) {
      // development push is enabled when you set dev_push to true
      // ionic config set dev_push true
      $ionicDevPush.init(this, this._defer);
    } else {
      this._plugin = PushNotification.init(config);
    }
    return this._defer.promise;
  };

  IonicPush.onRegister = function(callback) {
    var self = this;
    if(typeof callback !== 'function') {
      callback = function(data) { console.log(data); };
    }

    this.registerCallback = callback;
    if(this._plugin) {
      this._plugin.on('registration', function(data) { self._token = data.registrationId; return callback(data); });
    }
  };

  IonicPush.onNotification = function(callback) {
    var self = this;
    if(typeof callback !== 'function') {
      callback = function(notification) { 
        self.processNotification(notification);
        console.log(notification);
        return true;
      };
    }

    this.notificationCallback = callback;
    if(this._plugin) {
      this._plugin.on('notification', function(notification) {
        self.processNotification(notification);
        return callback(notification);
      });
    }
  };

  IonicPush.processNotification = function(notification) {
    this._notification = notification;
    if(notification.additionalData.foreground === false) {
      $ionicPushAction.notificationNavigation(notification);
    }
  };

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

  IonicPush.onError = function(callback) {
    if(!this._plugin) { return false; }
    if(typeof callback === 'function') {
      this._plugin.on('error', function(err) { return callback(err); });
    } else {
      this._plugin.on('error', function(err) { 
        console.log('Ionic Push: Unexpected error occured.');
        console.log(err);
      });
    }
  };

  IonicPush.unregister = function(callback, errorCallback) {
    if(!this._plugin) { return false; }
    return this._plugin.unregister(callback, errorCallback);
  };

  IonicPush.getPayload = function() {
    var payload = {};
    if(this._notification) {
      if(this._notification.additionalData && this._notification.additionalData.payload) {
        payload = this._notification.additionalData.payload;
      }
    }
    return payload;
  };

  IonicPush.getPlugin = function() {
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
  }

  return new IonicPushService(app);

}])

.factory('$ionicPushAction', ['$rootElement', '$injector', function($rootElement, $injector) {

  var IonicPushActionService = function(){};
  var IonicPushAction = IonicPushActionService.prototype;

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
      // Auto navigate to state
      $state = injector.get('$state');
      $state.go(state, stateParams);
    }
  };

  return new IonicPushActionService();
}])

.factory('$ionicDevPush', ['$rootScope', '$http', '$ionicApp', function($rootScope, $http, $ionicApp) {

  var IonicDevPushService = function(){
    this._service_host = $ionicApp.getValue('push_api_server'),
    this._token = false;
    this._watch = false;
  };
  var IonicDevPush = IonicDevPushService.prototype;


  IonicDevPush.getDevToken = function() {
    // Some crazy bit-twiddling to generate a random guid
    var token = 'DEV-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
    this._token = token;
    return this._token;
  };


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

  IonicDevPush.watch = function() {
    // Check for new dev pushes every 5 seconds
    console.log('Ionic Push: Watching for new notifications');
    var self = this;
    if(!this._watch) {
      this._watch = setInterval(function() { self.checkForNotifications() }, 5000);
    }
  };

  IonicDevPush.halt = function() {
    if(this._watch) {
      clearInterval(this._watch);
    }
  };

  return new IonicDevPushService();

}]);
