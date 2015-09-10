# Ionic Push Service Module

The main interface for Ionic apps to handle push notifications.
Check out our [docs](http://docs.ionic.io/v1.0/docs/push-overview) for more detailed information.

## Installation

Using the latest [Ionic CLI](https://github.com/driftyco/ionic-cli):

1.  Run `ionic add ionic-service-core`
2.  Run `ionic add ionic-service-push`
3.  Run `ionic plugin add phonegap-plugin-push`

## Example Usage

```javascript

Ionic.io(); // Initialize the Ionic Platform

// Initialize the Push Service
var push = Ionic.Push({
  "debug": true,
  "onNotification": function(notification) {
    var payload = $ionicPush.getPayload(notification);
    console.log(notification, payload);
  },
  "onRegister": function(data) {
    console.log(data);
  }
});

// Registers for a device token using the options passed to init()
push.register(successCallback, errorCallback);

// Unregister the current registered token
push.unregister();
```

## Building

1. Install Dependencies `npm install`
2. Run `gulp build`

## Development

You can run `gulp watch` to continously build changes.
