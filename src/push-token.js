(function() {

  class IonicPushToken {

    constructor(token) {
      this._token = token || null;
    };

    set token(value) {
      this._token = value;
    }

    get token() {
      return this._token;
    }

    toString() {
      var token = this._token || 'null';
      return '<IonicPushToken [\'' + token + '\']>';
    };
  };

  ionic.io.register('push');
  ionic.io.push.Token = IonicPushToken;

})();

