// Heavily borrowed from dhotson (http://dhotson.tumblr.com/post/271733389/a-simple-chat-server-in-node-js) and
// Guille (http://github.com/Guille/node.websocket.js/blob/master/websocket.js)

var sys = require('util');
var tcp = require('net');

var log   = require('./log');
log.level = log.DEBUG;

// Should break this out
Array.prototype.each = function(fn) {
  for (var i = 0; i < this.length; i++) fn(this[i]);
}

Array.prototype.remove = function(e) {
  for (var i = 0; i < this.length; i++)
    if (e == this[i]) return this.splice(i, 1);
}

// This is kind of ugly. Should get rid of it
var module = this;

this.WebSocket = {
  requestHeaders: [
    /^GET (\/[^\s]*) HTTP\/1\.1$/,
    /^Upgrade: WebSocket$/,
    /^Connection: Upgrade$/,
    /^Host: (.+)$/,
    /^Origin: (.+)$/
  ],

  responseHeaders: [
    'HTTP/1.1 101 Web Socket Protocol Handshake',
    'Upgrade: WebSocket',
    'Connection: Upgrade',
    'WebSocket-Origin: __ORIGIN__',
    'WebSocket-Location: ws://__HOST____RESOURCE__',
    '',
    ''
  ]
}

// This is the class that will be running
this.ChatServer = function(options) {
  this.connections    = [];
  this.history        = [];
  this.nextIdToAssign = 0;
  this.server         = null;

  var self = this;

  this.addConnection = function(connection) {
    self.connections.push(connection);
    connection.id = self.nextIdToAssign++;
    log.debug('Connections: ' + self.connections.length);
  };

  // Broadcast a message to all clients. The advantage of having this
  // is that we can keep track of all message that have come through and
  // replay the last N messages when new clients log on.
  this.broadcast = function(fn) {
    self.connections.each(function(connection) {
     var data = fn(connection);
     connection.send(data);
    })

    self.history.push(fn({}));
  };

  this.lastNMessages = function(N) {
    if (self.history.length < N) {
      N = self.history.length;
    }

    var lastNMessages = []
    for (var idx = self.history.length - N; idx < self.history.length; ++idx) {
      lastNMessages.push(self.history[idx]);
    }
    return lastNMessages;
  }

  this.removeConnection = function(connection) {
    self.connections.remove(connection);
    log.debug('Connections: ' + self.connections.length);

    self.broadcast(function(conn) {
      return ['status', { 'nick': connection.nick, 'status': 'off' }];
    });
  };

  this.say = function(connection, message) {
    self.broadcast(function(conn) {
      return ['said', {
        'isSelf': (conn.id == connection.id),
        'message': message,
        'nick': connection.nick
      }];
    });
  };

  this.start = function() {
    // Create the server object
    this.server = tcp.createServer(function(socket) {
      // Everytime a new socket is opened, create a new
      // connection object representing a client.
      // Push into member variable
      var connection = new module.Connection(self, socket);
      self.addConnection(connection);
    });

    self.server.listen(7000);
  };
};

this.Connection = function(server, socket) {
  this.data                     = '';
  this.hasDoneCoolGuyHandshake  = false;
  this.id                       = null;
  this.nick                     = null;

  var self = this;

  // The following params seem redundant, but better to be explicit (right? Githubbers help!)
  this.init = function(server, socket) {
    self.server = server;
    self.socket = socket;

    // Socket setup
    self.socket.setEncoding('utf8');
    self.socket.setNoDelay(true); // disabling Nagle's algorithm is encouraged for real time transmissions
    self.socket.setTimeout(0);

    // Hooking up listeners
    self.socket.addListener('connect',  self.connect);
    self.socket.addListener('eof',      self.eof);
    self.socket.addListener('receive',  self.receive);

    // Hooking up handlers
    // self.handlers = self.handlers();
  }

  this.connect = function() {
    log.info(self.logFormat('New user connected'));
  }

  this.disconnect = function() {
    log.info(self.logFormat('Disconnecting connection'));
    self.server.removeConnection(self);
    self.socket.close();
  }

  this.eof = function() {
    log.info(self.logFormat('Received EOF from Connection'));
    self.disconnect();
  };

  this.handleData = function(rawData) {
    log.debug(self.logFormat('handleData: ' + rawData));
    var jsonData = JSON.parse(rawData);

    if (typeof(jsonData) != 'object' || jsonData.length != 2) {
      log.fatal('Message format wrong: ' + sys.inspect(jsonData));
      log.fatal('Message format wrong: ' + rawData);
      return;
    }

    var action  = jsonData[0];
    var data    = jsonData[1];

    if (self.handlers[action]) {
      self.handlers[action](self, data);
    }
    else {
      log.warn('Did not find handler for "' + action + '"');
    }

  };

  this.logFormat = function(message) {
    return '[' + self.id + '] ' + message;
  }

  this.receive = function(data) {
    if (!self.hasDoneCoolGuyHandshake) {
      self.thenDoIt(data);
      return;
    }

    log.debug(self.logFormat('Received data: ' + data));
    if (data.indexOf('\ufffd') != -1) {
      var completeData = self.data + data.replace('\ufffd', '');
      if (completeData[0] != '\u0000') {
        log.error(self.logFormat('Data framed incorrectly'));
        self.disconnect();
        return;
      }

      // Sanitize it some more
      completeData = completeData.replace('\u0000', '');

      log.info(self.logFormat('Complete Data Received: ' + completeData));
      self.handleData(completeData);
      self.data = '';
    }
    else {
      log.debug(self.logFormat('Imcomplete data chunk'));
      self.data += data;
    }
  };

  this.send = function(data) {
    try {
      // Funkalicious
      log.debug(self.logFormat('Sending Data: ' + JSON.stringify(data)));
      self.socket.send('\u0000' + JSON.stringify(data) + '\uffff');
    }
    catch(e) {
      self.disconnect();
    }
  };

  // Do the handshake
  this.thenDoIt = function(data) {
    var headers = data.split('\r\n');
    var matches = [];

    log.debug(self.logFormat('Starting handshaking'));

    if (headers.length == 0) {
      // http://www.youtube.com/watch?v=vF4iWIE77Ts
      return false;
    }

    for (var index = 0; index < headers.length; ++index) {
      var match = headers[index].match(module.WebSocket.requestHeaders[index]);
      if (match && match.length > 1) {
        matches.push(match[1]);
      }
      else if (!match) {
        // Bad header: http://www.youtube.com/watch?v=QQb7-oWkctI
        self.disconnect();
        return false;
      }
    }

    var resource  = matches[0]; // Could be used for "chat room"
    var host      = matches[1];
    var origin    = matches[2];

    var data = module.WebSocket.responseHeaders.join('\r\n');
    data = data.replace('__HOST__',     host);
    data = data.replace('__ORIGIN__',   origin);
    data = data.replace('__RESOURCE__', resource);

    self.socket.send(data);
    self.hasDoneCoolGuyHandshake = true; // <-- Cool guy B-)
  };

  self.init(server, socket);
};

this.Connection.prototype.handlers = {
  assignNick: function(connection, data) {
    log.debug(connection.logFormat('Assigning nick: ' + data));
    connection.nick = data;

    connection.send(['lastMessage', connection.server.lastNMessages(5)]);
    connection.server.broadcast(function(conn) {
      return ['status', { 'nick': connection.nick, 'status': 'on' }];
    })
  },

  say: function(connection, data) {
    connection.server.say(connection, data);
  }
};

