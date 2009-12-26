var assert = require('assert');
var sys = require('sys');

var chatServer = require('../../server/server');
var log = require('../../server/log');
log.level = log.FATAL;

FakeSocket = function() {
  this.setEncoding = function() {};
  this.setNoDelay  = function() {};
  this.setTimeout  = function() {};
  this.addListener = function() {};
}

function testHandlersPresent() {
  var server      = new chatServer.ChatServer();
  var connection  = new chatServer.Connection(server, new FakeSocket());
  assert.ok(typeof(connection.handlers.assignNick) == 'function', 'assignNick should be a handler');
}

function testHandleJsonData() {
  var server      = new chatServer.ChatServer();
  var connection  = new chatServer.Connection(server, new FakeSocket());

  connection.handleData(JSON.stringify([ "assignNick", "bdot" ]));
  assert.equal(connection.nick, 'bdot', 'It should assign the nick to the connection');
}

testHandleJsonData();
testHandlersPresent();
