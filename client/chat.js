$(document).ready(function(){
  NodeJsChat.connect();
  $('#chat_form').submit(NodeJsChat.onformsubmit);
});

NodeJsChat = {
  ws: null,

  connect: function() {
    NodeJsChat.ws = new WebSocket("ws://localhost:7000");
    NodeJsChat.ws.onmessage = NodeJsChat.onmessage;
    NodeJsChat.ws.onclose   = NodeJsChat.onclose
    NodeJsChat.ws.onopen    = NodeJsChat.onopen;
  },

  // This doesn't belong here buttttttttttt....
  debug: function(str) {
    $("#debug").append("<p>"+str+"</p>");
  },

  onclose: function() {
    NodeJsChat.debug('socket closed');
  },

  onformsubmit: function() {
    var message = $('#chat_form_input').val();
    if (message != '') {
      NodeJsChat.say(message);
      $('#chat_form_input').val('');
    }

    return false;
  },

  onmessage: function(evt) {
    $("#msg").append("<p>"+JSON.parse(evt.data)+"</p>");
  },

  onopen: function() {
    NodeJsChat.debug('Connected...');
  },

  say: function(message) {
    NodeJsChat.ws.send(message);
    return false;
  }
};

NodeJsChat.handlers = {

};
