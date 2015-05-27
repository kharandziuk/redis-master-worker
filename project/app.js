var redis = require("redis"),
    async = require('async'),
    assert = require('assert'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    uuid = require('node-uuid'),
    _ = require('underscore'),
    log = console.log;


// constants
var SEMAPHORE_ADDRESS = 'semaphore',
    MASTER_TO_WORKER_CHANNEL = 'MASTER-TO-WORKER-CHANNEL',
    WORKER_TO_MASTER_CHANNEL = 'WORKER-TO-MASTER-CHANNEL',
    ASKER_MODES = {
      ASK: 0,
      RENEW: 1
    },
    COMMAND = {
      CHECK: 'check',
      JOB:  'JOB',
      ASK_JOB: 'ask_job'
    };


var SemaphoreAsker = function(client) {
  var self = this;
  self.mode = ASKER_MODES.ASK;
  var ask = function (next) {
    client.set([SEMAPHORE_ADDRESS, true, 'NX', 'EX', 1], function(err, val) {
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
    client.set([SEMAPHORE_ADDRESS, true, 'EX', 1], function(err, val) {
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

var Minion = function(redisHost) {
  var self = this;
  self.id = uuid.v4();
  self.isMaster = false;
  var subscribeClient = redis.createClient('6379', 'redis');
  var operationClient = redis.createClient('6379', 'redis');
  subscribeClient.subscribe(MASTER_TO_WORKER_CHANNEL);
  subscribeClient.on('subscribe', function(channel, count) {
    switch(channel) {
      case MASTER_TO_WORKER_CHANNEL:
        console.log(MASTER_TO_WORKER_CHANNEL);
        assert(!self.isMaster);
        break;
      case WORKER_TO_MASTER_CHANNEL: 
        console.log(WORKER_TO_MASTER_CHANNEL);
        assert(self.isMaster);
        break;
      default:
        assert.fail();
    }
  });
  subscribeClient.on('message', function(channel, message) {
    log(message);
    message = JSON.parse(message);
    assert(!_.isUndefined(message.type));
    log(channel);
    switch(channel) {
      case MASTER_TO_WORKER_CHANNEL:
        self.workerMessageHandler(message);
        break;
      case WORKER_TO_MASTER_CHANNEL: 
        self.masterMessageHandler(message);
        break;
      default:
        assert.fail();
    }
  });
  self.subscribeClient = subscribeClient;
  self.operationClient = operationClient;
  self.asker = new SemaphoreAsker(operationClient);
  self.asker.on('crown', function() {
    self.upgradeToMaster();
  });
};

Minion.prototype.masterMessageHandler = function (message) {
  assert(this.isMaster);
  switch(message.type) {
    case COMMAND.ASK_JOB:
      log('master gives a job');
      this.operationClient.publish(
        MASTER_TO_WORKER_CHANNEL, 
        JSON.stringify({
          type: COMMAND.JOB,
          id: message.id,
          body: this.getMessage()})
      );
      break;
    default:
      assert.fail();
  }

};

Minion.prototype.workerMessageHandler = function (message) {
  //assert(!this.isMaster);
  switch(message.type) {
    case(COMMAND.CHECK):
      log(this.id, 'ask job');
      this.operationClient.publish(
          WORKER_TO_MASTER_CHANNEL,
          JSON.stringify({type: COMMAND.ASK_JOB, id: this.id})
      );
      break;
    case(COMMAND.JOB):
      if(this.id === message.id){
        this.eventHanler(message.body, this.onMessageProcessed.bind(this));
      }
      break;
    default:
      assert.fail();
  }
};

Minion.prototype.onMessageProcessed = function(err, data) {
  if (err) {
    this.operationClient.lpush('errors', data);
  }
  this.operationClient.lpush('processed', data);
  log('processed', data);
};

Minion.prototype.getMessage = function () {
  this.cnt = this.cnt || 0;
  return this.cnt++;
};

Minion.prototype.eventHanler = function(msg, callback) {
  function onComplete() {
    var error = Math.random() > 0.85;
    callback(error, msg);
  }
  setTimeout(onComplete, Math.floor(Math.random()*1000));
};

Minion.prototype.upgradeToMaster = function() {
  var self = this;
  this.isMaster = true;
  this.asker.mode = ASKER_MODES.RENEW;
  this.subscribeClient.unsubscribe(MASTER_TO_WORKER_CHANNEL);
  this.subscribeClient.subscribe(WORKER_TO_MASTER_CHANNEL);

  self.subscribeClient.on('unsubscribe', function(channel, count) {
    async.forever(
      function(next) {
        console.log('kapa');
        self.operationClient.publish(MASTER_TO_WORKER_CHANNEL, JSON.stringify({type: COMMAND.CHECK}));
        setTimeout(
          next,
          1000
        );
      }
    );
  });
};

new Minion();
