'use strict'

const {RTCPeerConnection} = require('wrtc')

const config = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:global.stun.twilio.com:3478'
            ]
        }
    ],
    sdpSemantics: 'unified-plan'
}

function Peer(socket) {
    this._pc = new RTCPeerConnection(config)
    this._socket = socket
    this._dataChanel = null
    this._candidateCache = []
}

Peer.prototype.addRTCHandlers = function() {
    const self = this
    self._pc.onicecandidate = function(iceEvent) {
        if(iceEvent.candidate) {
            self._candidateCache.push(iceEvent.candidate)
        }
        else if (!iceEvent.candidate){
            console.log(self._pc.localDescription.type)
            self._socket.emit(self._pc.localDescription.type, {
                description: self._pc.localDescription,
                candidates: self._candidateCache
            })
        }
    }
    self._pc.onconnectionstatechange = function () {
        console.log(self._pc.connectionState)
    }
}

Peer.prototype.createOffer = function () {
    const self = this
    self._pc.createOffer()
        .then(offer => {
            self._pc.setLocalDescription(offer)
        })
}

Peer.prototype.addIceCandidates = function (candidates) {
    const self = this
    candidates.forEach(candidate => {
        self._pc.addIceCandidate(candidate)
    })
}

Peer.prototype.setRemoteDescription = function (description) {
    const self = this
    self._pc.setRemoteDescription(description)
}

Peer.prototype.applyOffer = function(offer) {
    const self = this
    self._pc.setRemoteDescription(offer.description)
        .then(() => {
            self._pc.createAnswer()
                .then(answer => {
                self._pc.setLocalDescription(answer)
                })
                    .then(() => {
                        self.addIceCandidates(offer.candidates)
                    })
        })
}

Peer.prototype.createDataChanel = function (channelName) {
    const self = this
    self._dataChanel = self._pc.createDataChannel(channelName)
}

Peer.prototype.addChannelHandlers = function(onerror, onmessage, onclose, onopen) {
    const self = this
    self._dataChanel.onmessage = onmessage
    self._dataChanel.onopen = onopen
    self._dataChanel.onerror = onerror
    self._dataChanel.onclose = onclose
}

Peer.prototype.getConnectionState = function() {
    const self = this
    return self._pc.connectionState
}

Peer.prototype.sendMessage = function(message) {
    const self = this
    if (self._dataChanel && self.getConnectionState() === 'connected') {
        self._dataChanel.send(message)
        return true
    }
    else
        return false
}

Peer.prototype.applyAnswer = function(answer) {
    const self = this
    self.setRemoteDescription(answer.description)
    self.addIceCandidates(answer.candidates)
}

module.exports = Peer