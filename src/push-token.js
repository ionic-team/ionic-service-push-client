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

  if((typeof ionic == 'undefined')) { ionic = {}; }
  if((typeof ionic.io == 'undefined')) { ionic.io = {}; }
  if((typeof ionic.io.push == 'undefined')) { ionic.io.push = {}; }

  ionic.io.push.Token = IonicPushToken;

})();

