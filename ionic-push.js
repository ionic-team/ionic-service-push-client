angular.module('ionic.service.push', ['ngCordova', 'ionic.service.core'])

/**
 * The Ionic Push service client wrapper.
 *
 */
.factory('$ionicPush', ['$http', '$cordovaPush', function($http, $cordovaPush, $ionicApp) {

  var iosConfig = {
    "badge": true,
    "sound": true,
    "alert": true,
  };

    var app = $ionicApp.getApp();

    console.log('GOT APPPLE', app);
  function init() {
    /*
    $cordovaPush.register(config).then(function(result) {
      // Success -- send deviceToken to server, and store 
      console.log("result: " + result)
      $http.post("http://server.co/", {user: "Bob", tokenID: result.deviceToken})
    });
    */
  }

  document.addEventListener("deviceready", function() {
    // Wait until the device is ready
    init();
  });
}]);
