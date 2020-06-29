'use strict'

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
            // console.log('emit')
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

    self._pc.ondatachannel = function (event) {
        const channel = event.channel

        channel.onclose = function () {
            console.log('channel close')
        }

        channel.onopen = function () {
            console.log('channel open')
            //todo test
            setInterval(() => {
                if (channel.readyState === 'open')
                    channel.send('kek from browser')
            }, 1000)
        }

        channel.onerror = function (error) {
            console.log(error)
        }

        channel.onmessage = function (message) {
            console.log(message.data)
        }
    }
}

Peer.prototype.createOffer = function () {
    const self = this
    this._pc.createOffer()
        .then(offer => {
            self._pc.setLocalDescription(offer)
            console.log(offer)
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

Peer.prototype.applyAnswer = function(offer) {
    const self = this
    self._pc.setRemoteDescription(offer.description)
    .then(() => {
        console.log('after remote')
        self._pc.createAnswer()
            .then(answer => {
                console.log('answer')
            self._pc.setLocalDescription(answer)
        })
            .then(() => {
                console.log('add ice')
                self.addIceCandidates(offer.candidates)
            })
    })
}

Peer.prototype.createDataChanel = function (chanelName) {
    const self = this
    self._dataChanel = self._pc.createDataChannel(chanelName)
}