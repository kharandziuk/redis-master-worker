var redis = require("redis"),
    client = redis.createClient(),
    Bacon = require('baconjs'),
    _ = require('underscore');

Bacon.repeat(function(){
  return Bacon.fromNodeCallback(
    client, 'lpop', ['errors']
  );
})
.takeWhile(_.negate(_.isNull))
.reduce(
    [],
    function(acc, next) {
      acc.push(next); return acc;
    }
).onValue(function(val) {
  console.log(val);
  client.quit();
});
