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
