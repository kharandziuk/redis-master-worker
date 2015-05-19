var redis = require("redis"),
    _ = require('underscore'),
    async = require('async'),
    client = redis.createClient();
    //client2 = redis.createClient(),
    //msg_count = 0;

//client1.on("subscribe", function (channel, count) {
//    client2.publish("a nice channel", "I am sending a message.");
//    client2.publish("a nice channel", "I am sending a second message.");
//    client2.publish("a nice channel", "I am sending my last message.");
//});
//
//client1.on("message", function (channel, message) {
//    console.log("client1 channel " + channel + ": " + message);
//    msg_count += 1;
//    if (msg_count === 3) {
//        client1.unsubscribe();
//        client1.end();
//        client2.end();
//    }
//});

//client1.incr("did a thing");
var isMaster = false,
    SEMAPHORE_ADDRESS = 'semaphore'
var lifeCycle = function(next) {
  if(isMaster) {
    client.set([SEMAPHORE_ADDRESS, true, 'EX', 5], function(err, val) {
      console.log('master lifecycle');
      if(err !== null) { throw err; }
      if(val === null) {
        assert(false);
      } else if(val === 'OK') {
        console.log('I`m master');
        console.log('everything ok; give them some tasks');
      }
      next();
    });
  } else {
    console.log('slave lifecycle');
    client.set([SEMAPHORE_ADDRESS, true, 'NX', 'EX', 5], function(err, val) {
      if(err !== null) { throw err; }
      if(val === null) {
        console.log('slave');
      } else if(val === 'OK') {
        console.log('I`m master');
        isMaster = true;
      }
      next();
    });
  }
};
async.forever(
  function(next) {
    setTimeout(
      lifeCycle.bind(null, next),
      1000
    );
  }
);
//client1.subscribe("a nice channel");
