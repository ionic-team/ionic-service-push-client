(function() {

  class PushToken {

    constructor(token) {
      this._token = token || null;
    }

    set token(value) {
      this._token = value;
    }

    get token() {
      return this._token;
    }

    toString() {
      var token = this._token || 'null';
      return '<PushToken [\'' + token + '\']>';
    }
  }

  Ionic.namespace('Ionic', 'PushToken', PushToken, window);

})();

