// Super simplistic logger
var sys = require('util');

this.FATAL  = 4;
this.ERROR  = 3;
this.WARN   = 2;
this.INFO   = 1;
this.DEBUG  = 0;

this.LEVELS_MAP = [
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR',
  'FATAL'
]

this.level = this.WARN;

var self = this;

this.debug = function(message) {
  self.log(this.DEBUG, message);
}

this.error = function(message) {
  self.log(this.ERROR, message);
}

this.fatal = function(message) {
  self.log(this.FATAL, message);
}

this.info = function(message) {
  self.log(this.INFO, message);
}

this.log = function(severity, message) {
  if (severity >= self.level) {
    // TODO make format dynamic
    sys.puts('[' + new Date() + '] ['+ this.LEVELS_MAP[severity] +'] ' + message);
  }
}

this.warn = function(message) {
  self.log(this.WARN, message);
}
