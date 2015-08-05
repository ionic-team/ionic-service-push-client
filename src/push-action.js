(function() {
  angular.module('ionic.service.push')

  /**
   * IonicPushAction Service
   * 
   * A utility service to kick off misc features as part of the Ionic Push service
   */
  .factory('$ionicPushAction', ['$rootElement', '$injector', function($rootElement, $injector) {

    var IonicPushActionService = function(){};
    var IonicPushAction = IonicPushActionService.prototype;

    /**
     * State Navigation
     *
     * Attempts to navigate to a new view if a push notification payload contains:
     *
     *   - $state {String} The state name (e.g 'tab.chats')
     *   - $stateParams {Object} Provided state (url) params
     *
     * Find more info about state navigation and params: 
     * https://github.com/angular-ui/ui-router/wiki
     *
     */
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
        $state = injector.get('$state');
        $state.go(state, stateParams);
      }
    };

    return new IonicPushActionService();
  }]);

})();
