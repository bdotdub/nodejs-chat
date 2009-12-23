// Heavily borrowed from dhotson (http://dhotson.tumblr.com/post/271733389/a-simple-chat-server-in-node-js) and
// Guille (http://github.com/Guille/node.websocket.js/blob/master/websocket.js)

var sys = require("sys");
var tcp = require("tcp");

// Should break this out
Array.prototype.remove = function(e) {
  for (var i = 0; i < this.length; i++)
    if (e == this[i]) return this.splice(i, 1);
}

WebSocket = {
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
ChatServer = function(options) {
  this.connections  = [];
  this.server       = null;

  var self = this;

  this.addConnection = function(connection) {
    self.connections.push(connection);
  };

  this.removeConnection = function(connection) {
    self.connections.remove(connection);
  };

  this.start = function() {
    // Create the server object
    this.server = tcp.createServer(function(socket) {
      // Everytime a new socket is opened, create a new
      // connection object representing a client.
      // Push into member variable
      var connection = new Connection(self, socket);
      self.addConnection(connection);
    });

    self.server.listen(7000);
  };
};

Connection = function(server, socket) {
  this.hasDoneCoolGuyHandshake = false;

  var self = this;

  // The following params seem redundant, but better to be explicit (right? Githubbers help!)
  this.init = function(server, socket) {
    self.server = server;
    self.socket = socket;

    // Socket setup
    self.socket.setEncoding("utf8");
    self.socket.setNoDelay(true); // disabling Nagle's algorithm is encouraged for real time transmissions
    self.socket.setTimeout(0);

    // Hooking up listeners
    self.socket.addListener('connect',  self.connect);
    self.socket.addListener('eof',      self.eof);
    self.socket.addListener('receive',  self.receive);
  }

  this.connect = function() {
    sys.puts('connected!');
  };

  this.disconnect = function() {
    self.server.removeConnection(self);
    self.socket.close();
  }

  this.eof = function() {
    sys.puts('eof!');
    self.disconnect();
  };

  this.receive = function(data) {
    sys.puts('======================');
    sys.puts('Data received: ' + data);
    if (!self.hasDoneCoolGuyHandshake) {
      self.thenDoIt(data);
      return;
    }

    // Data parsing

    sys.puts('received!');
  };

  this.send = function(data) {
    try {
      // Funkalicious
      sys.puts('----------------------');
      sys.puts('Data sending: ' + data);
      self.socket.send('\u0000' + data + '\uffff');
    }
    catch(e) {
      self.disconnect();
    }
  };

  // Do the handshake
  this.thenDoIt = function(data) {
    var headers = data.split('\r\n');
    var matches = [];

    if (headers.length == 0) {
      // http://www.youtube.com/watch?v=vF4iWIE77Ts
      return false;
    }

    for (var index = 0; index < headers.length; ++index) {
      var match = headers[index].match(WebSocket.requestHeaders[index]);
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

    var data = WebSocket.responseHeaders.join('\r\n');
    data = data.replace('__HOST__',     host);
    data = data.replace('__ORIGIN__',   origin);
    data = data.replace('__RESOURCE__', resource);

    self.socket.send(data);
    self.hasDoneCoolGuyHandshake = true; // <-- Cool guy B-)
  };

  self.init(server, socket);
};

var server = new ChatServer();
server.start();
