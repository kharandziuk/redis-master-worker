var redis = require("redis"),
    _ = require('underscore'),
    async = require('async'),
    client = redis.createClient();
    listener = redis.createClient();

listener.subscribe("channel");
var isMaster = false,
    SEMAPHORE_ADDRESS = 'semaphore';
listener.on('message', function() {
  if(isMaster) {return;}
  console.log('message', arguments);
});
var lifeCycle = function(next) {
  if(isMaster) {
    client.set([SEMAPHORE_ADDRESS, true, 'EX', 5], function(err, val) {
      console.log('master lifecycle');
      if(err !== null) { throw err; }
      else if(val === 'OK') {
        console.log('everything ok; I will send slaves some tasks');
        listener.publish('channel', 'message from master', function(err) {
          console.log(err);
          if(err) {throw err;}
        });
      } else {
        assert.fail();
      }
      next();
    });
  } else {
    client.set([SEMAPHORE_ADDRESS, true, 'NX', 'EX', 5], function(err, val) {
      if(err !== null) { throw err; }
      if(val === null) {
        console.log('slaves takes some tasks');
      } else if(val === 'OK') {
        console.log('I`m master');
        isMaster = true;
      }
      next();
    });
  }
};
listener.on('subscribe', function() {
  async.forever(
    function(next) {
      setTimeout(
        lifeCycle.bind(null, next),
        1000
      );
    }
  );
});
