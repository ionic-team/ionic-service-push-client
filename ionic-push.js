angular.module('ionic.services.push', ['ngCordova', 'ionic.services.core'])

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

  function init() {
    var app = $ionicApp.getApp();

    console.log('GOT APP', app);
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
});
