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
        '$http', '$cordovaPush', '$ionicApp', '$log',

        function($http, $cordovaPush, $ionicApp, $log) {

            //Default configuration for iOS
            var iosConfig = {
                "badge": true,
                "sound": true,
                "alert": true
            };

            // Grab the current app
            var app = $ionicApp.getApp();

            //Check for required credentials
            if(!app || !app.app_id) {
                $log.error('PUSH: Unable to initialize, you must call $ionicAppProvider.identify() first');
            }

            function init(metadata) {
                var api = $ionicApp.getValue('push_api_server');
                $log.debug('PUSH: Connecting to push api');

                $cordovaPush.register(iosConfig).then(function(token) {
                    $log.debug('Success! Registering token with Ionic');

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
                        .success(function(data, status) {
                            $log.debug("Success: " + data);
                        })
                        .error(function(error, status, headers, config) {
                            $log.debug("Error: " + error + " " + status + " " + headers);
                        });
                });
            }

            return {
                register: function(metadata){
                    app && init(metadata);
                }
            }
        }]);
