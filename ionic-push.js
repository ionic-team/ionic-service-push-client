angular.module('ionic.service.push', ['ngCordova', 'ionic.service.core'])

/**
 * The Ionic Push service client wrapper.
 * 
 * Example:
 * 
 * angular.controller(['$scope', '$ionicPush', function($scope, $ionicPush) {
 *  
 *   
 }])
 *
 */
.factory('$ionicPush', [
  '$http', '$cordovaPush', '$ionicApp', '$log',
  
function($http, $cordovaPush, $ionicApp, $log) {

  var iosConfig = {
    "badge": true,
    "sound": true,
    "alert": true,
  };

  // Grab the current app
  var app = $ionicApp.getApp();
  
  if(!app || !app.app_id) {
    $log.error('PUSH: Unable to initialize, you must call $ionicAppProvider.identify() first');
  }

  function init() {
    var api = $ionicApp.getValue('push_api_server');
    $log.debug('PUSH: Connecting to push api', api);

    $cordovaPush.register(iosConfig).then(function(result) {

      // Success -- send deviceToken to server, and store 
      var req = {
        method: 'POST',
        url: api + "/api/v1/register-device-token",
        headers: {
          'X-Ionic-Applicaton-Id': $ionicApp.getId(),
          'X-Ionic-API-Key': $ionicApp.getApiKey()
        },
        data: {
          ios_token: token,
          metadata: {
          }
        }
      };

      $http(req)
        .success(function(data, status) {
          alert("Success: " + data);
        })
        .error(function(error, status, headers, config) {
          alert("Error: " + error + " " + status + " " + headers);
        });
    });
  }

  document.addEventListener("deviceready", function() {
    // Wait until the device is ready
    app && init();
  });

  return {
  }
}]);
