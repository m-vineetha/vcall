const name = prompt("What's your name?");
document.getElementById("nam1").innerHTML = name;

// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('J2goW4x1Suo3Oz91');
// Room name needs to be prefixed with 'observable-'
// Room name initialization
const roomName = 'observable-' + roomHash;

//Let us use public google stun server
const ser = {
  //initializing google server
  iceServers: [{

    urls: 'stun:stun.l.google.com:19302' //google stun server

  }]
};
let room;
let pc;


//Function when connection is success
function success() {};

//Throw error if there is one
function onError(error) {
  console.error(error);
};

//If there is an error when connecting to the room
drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  //subscribe to the room
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });

//Signaling server is ready.
room.on('members', members => {
	console.log('MEMBERS', members);
	// If we are the second user to connect to the room we will be creating the offer
	const isOfferer = members.length === 2;
	beginWebRTC(isOfferer);
  });
});

// Transfer signaling data via scale drone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

//Starting WebRTC server
function beginWebRTC(isOfferer) {
  //new connection
  newCon = new RTCPeerConnection(ser);

  newCon.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  // If you are offerer, then let the 'negotiationneeded' event initiaite the offer creation
  if (isOfferer) {
    newCon.onnegotiationneeded = () => {
      newCon.createOffer().then(localDescriptionCreated).catch(onError);
    }
  }

  // Display remote stream in the #remote element
  newCon.ontrack = event => {
    const stream = event.streams[0];
    if (!remote.srcObject || (remote.srcObject.id !== stream.id)) {
      remote.srcObject = stream;
    }
  };


navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {

    // Displays our video in #local element
    local.srcObject = stream;

    // Send to peer
    stream.getTracks().forEach(track => newCon.addTrack(track, stream));
  }, onError);

  // Scale Drone sends signaling data
  room.on('data', (message, client) => {

    // We send message
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      
      newCon.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {

        // Answer when recieving an offer
        if (newCon.remoteDescription.type === 'offer') {
          newCon.createAnswer().then(localDescriptionCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {

      //Adding ICE candidate
      newCon.addIceCandidate(
        new RTCIceCandidate(message.candidate), success, onError
      );
    }
  });
}

// Local Description Creation
function localDescriptionCreated(desc) {

  newCon.setLocalDescription(
    desc,
    () => sendMessage({'sdp': newCon.localDescription}),
    onError
  );

}

function hangUpCall() {
  closeVideoCall();
  sendToServer({
    name: myUsername,
    target: targetUsername,
    type: "hang-up"
  });
}
function myFunction() {
  document.getElementById("demo").innerHTML = roomHash;
}

function closeVideoCall() {
  var remoteVideo = document.getElementById("remote");
  var localVideo = document.getElementById("local");

  if (newCon) {
    newCon.ontrack = null;
    newCon.onremovetrack = null;
    newCon.onremovestream = null;
    newCon.onicecandidate = null;
    newCon.oniceconnectionstatechange = null;
    newCon.onsignalingstatechange = null;
    newCon.onicegatheringstatechange = null;
    newCon.onnegotiationneeded = null;

    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    newCon.close();
    newCon = null;
  }

  remoteVideo.removeAttribute("src");
  remoteVideo.removeAttribute("srcObject");
  localVideo.removeAttribute("src");
  remoteVideo.removeAttribute("srcObject");

  document.getElementById("hangup-button").disabled = true;
  targetUsername = null;
}
