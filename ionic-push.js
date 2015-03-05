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
  '$http', '$cordovaPush', '$ionicApp', '$log', '$q',

function($http, $cordovaPush, $ionicApp, $log, $q) {

  // Grab the current app
  var app = $ionicApp.getApp();

  //Check for required credentials
  if(!app || !app.app_id) {
    console.error('PUSH: Unable to initialize, you must call $ionicAppProvider.identify() first');
  }

  function init(metadata) {
    var defer = $q.defer();

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
      console.log('Device token:', token);

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

        $http(req)
          .success(function (data, status) {
            console.log('Register success', data);
          })
          .error(function (error, status, headers, config) {
            console.log('Register error! Code:', status, error, headers);
          });
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
          ios_token: token,
          metadata: metadata
        }
      };

      $http(req)
        .success(function(data, status) {
          console.log('Register success', data);
        })
        .error(function(error, status, headers, config) {
          console.log('Register error! Code:', status, error, headers);
        });
  }

  return {
      register: function(metadata){
        if(app) {
          return init(metadata);
        }
      },
      callback: function(token, metadata){
          app && androidInit(token, metadata);
      }
  }
}]);
