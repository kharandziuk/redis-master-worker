var redis = require("redis"),
    async = require('async'),
    client = redis.createClient(),
    assert = require('assert'),
    EventEmitter = require('events').EventEmitter;
    util = require('util');

// constants
var SEMAPHORE_ADDRESS = 'semaphore',
    ASKER_MODES = {
      ASK: 0,
      RENEW: 1
    };


var SemaphoreAsker = function() {
  var self = this;
  self.mode = ASKER_MODES.ASK;
  var ask = function (next) {
    client.set([SEMAPHORE_ADDRESS, true, 'NX', 'EX', 5], function(err, val) {
      console.log('in loop');
      if(err !== null) { throw err; }
      if(val === 'OK') {
        self.emit('crown');
      } else if (val !== null){
        assert.fail();
      }
      next();
    });
  };
  var renew = function (next) {
    client.set([SEMAPHORE_ADDRESS, true, 'EX', 5], function(err, val) {
      console.log('in renew loop');
      if(err !== null) { throw err; }
      if(val !== 'OK') {
        assert.fail('something goes wrong');
      }
      next();
    });
  };
  async.forever(
    function(next) {
      var callbacks = {};
      callbacks[ASKER_MODES.ASK] = ask;
      callbacks[ASKER_MODES.RENEW] = renew;
      setTimeout(
        callbacks[self.mode].bind(self, next),
        1000
      );
    }
  );
};
util.inherits(SemaphoreAsker,  EventEmitter);

var Minion = function() {
  var self = this;
  self.isMaster = false;
  self.asker = new SemaphoreAsker();
  self.asker.on('crown', function() {
    self.upgradeToMaster();
  });
};

Minion.prototype.getMessage = function () {
  this.cnt = this.cnt || 0;
  return this.cnt++;
};

Minion.prototype.upgradeToMaster = function() {
  this.isMaster = true;
  this.asker.mode = ASKER_MODES.RENEW;
};

new Minion();
