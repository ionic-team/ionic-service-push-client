angular.module('ionic.service.push', ['ngCordova', 'ionic.service.core'])

/**
 * The Ionic Push service client wrapper.
 *
 * Example:
 *
 * angular.controller(['$scope', '$ionicPush', function($scope, $ionicPush) {
 * }])
 *
 */
.factory('$ionicPush', [
  '$http', '$cordovaPush', '$ionicApp', '$ionicUser', '$rootScope', '$log', '$q',

function($http, $cordovaPush, $ionicApp, $ionicUser, $rootScope, $log, $q) {

  // Grab the current app
  var app = $ionicApp.getApp();

  //Check for required credentials
  if(!app || !app.app_id) {
    console.error('PUSH: Unable to initialize, you must call $ionicAppProvider.identify() first');
  }

  function init(options, metadata) {
    var defer = $q.defer();

    // TODO: This should be part of a config not a direct method
    var gcmKey = $ionicApp.getGcmId();
    var api = $ionicApp.getValue('push_api_server');

    //Default configuration
    var config = {
      "senderID": gcmKey,
      "badge": true,
      "sound": true,
      "alert": true
    };

    $cordovaPush.register(config).then(function(token) {
      console.log('$ionicPush:REGISTERED', token);

      defer.resolve(token);

      if(token !== 'OK') {
        // Success -- send deviceToken to server, and store
        var req = {
          method: 'POST',
          url: api + "/api/v1/register-device-token",
          headers: {
            'X-Ionic-Application-Id': $ionicApp.getId(),
            'X-Ionic-API-Key': $ionicApp.getApiKey()
          },
          data: {
            ios_token: token,
            metadata: metadata
          }
        };

        // Push the token into the user data
        try {
          $ionicUser.push('push.ios_tokens', token);
        } catch(e) {
          console.warn('Received push token before user was identified and will not be synced with ionic.io. Make sure to call $ionicUser.identify() before calling $ionicPush.register.');
        }

        $http(req)
          .success(function (data, status) {
            console.log('Register success', JSON.stringify(data));
          })
          .error(function (error, status, headers, config) {
            console.log('Register error! Code:', status, error, headers);
          });
      }
    });

    $rootScope.$on('$cordovaPush:notificationReceived', function(event, notification) {
      console.log('$ionicPush:RECEIVED', JSON.stringify(notification));

      var callbackRet = options.onNotification && options.onNotification(notification);

      // If the custom handler returns false, don't handle this at all in
      // our code
      if(callbackRet === false) {
        return;
      }

      if (ionic.Platform.isAndroid() && notification.event == "registered") {
        /**
         * Android handles push notification registration in a callback from the GCM service (whereas
         * iOS can be handled in a single call), so we need to check for a special notification type
         * here.
         */
        console.log('$ionicPush:REGISTERED', notification.regid);
        androidInit(notification.regid, metadata);
      }
      
      // If we have the notification plugin, show this
      if(options.canShowAlert && notification.alert) {
        if (navigator.notification) {
          navigator.notification.alert(notification.alert);
        } else {
          // Browser version
          alert(notification.alert);
        }
      }

      if(options.canPlaySound) {
        if (notification.sound && window.Media) {
          var snd = new Media(event.sound);
          snd.play();
        }
      }

      if(options.canSetBadge) {
        if (notification.badge) {
          $cordovaPush.setBadgeNumber(notification.badge).then(function(result) {
            // Success!
          }, function(err) {
            console.log('Could not set badge!', err);
            // An error occurred. Show a message to the user
          });
        }
      }
    });
    

    return defer.promise;
  }

  function androidInit(token, metadata) {
    var api = $ionicApp.getValue('push_api_server');
    var req = {
      method: 'POST',
      url: api + "/api/v1/register-device-token",
      headers: {
        'X-Ionic-Application-Id': $ionicApp.getId(),
        'X-Ionic-API-Key': $ionicApp.getApiKey()
      },
      data: {
        android_token: token,
        metadata: metadata
      }
    };

    // Push the token into the user data
    try {
      $ionicUser.push('push.android_tokens', token);
    } catch(e) {
      console.warn('Received push token before user was identified and will not be synced with ionic.io. Make sure to call $ionicUser.identify() before calling $ionicPush.register.');
    }
    

    $http(req)
      .success(function(data, status) {
        console.log('Register success', data);
      })
      .error(function(error, status, headers, config) {
        console.log('Register error! Code:', status, error, headers);
      });
  }

  return {
    /**
     * Register for push notifications.
     *
     * Configure the default notification behavior by using the options param:
     *
     * {
     *   // Whether to allow notifications to pop up an alert while in the app.
     *   // Setting this to false lets you control the push behavior more closely.
     *   allowAlert: true/false (default: true)
     *
     *   // Whether to allow notifications to update the badge
     *   allowBadge: true/false (default: true)
     *
     *   // Whether to allow notifications to play a sound
     *   allowSound: true/false (default: true)
     *
     *   // A callback to do some custom task on notification
     *   onNotification: true/false (default: true)
     * }
     */
    register: function(options, metadata){
      if(!app) { return; }

      options = angular.extend({
        canShowAlert: true,
        canSetBadge: true,
        canPlaySound: true,
        onNotification: function() { return true; }
      }, options);

      return init(options, metadata);
    },
    unregister: function(options) {
      return $cordovaPush.unregister(options);
    }
  }
}]);


