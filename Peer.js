'use strict'
const SimplePeer = require('simple-peer')
const webRTC = require('wrtc')
const EventEmitter = require('events')

/** constructor **/
function Peer() {
    this._event = new EventEmitter()
    this.peer = null
    this.on = this._event.on.bind(this._event)
}

Peer.prototype.sendMessage = function (message) {
    this.peer.send(message)
}

/**  **/
Peer.prototype.createConnection = function () {
    const self = this
    /** peer init **/
    self.peer = new SimplePeer({
        initiator: true,
        trickle: false,
        wrtc: webRTC
    })
    /**
     * event handlers
     *
     * **/
    /** signal event (offer/answer) **/
    self.peer.on('signal', signal => {
        this._event.emit('signal', signal)
    })

    /** connection event **/
    self.peer.on('connect', () => {
        console.log('connect')
        this._event.emit('connect')
    })

    /** receive data event **/
    self.peer.on('data', data => {
        this._event.emit('data', data)
    })

    /** close event **/
    self.peer.on('close', () => {
        console.log('close')
        this._event.emit('close')
    })

    /** error event **/
    self.peer.on('error', err => {
        console.error(err)
        this._event.emit('error', err)
    })

}

/** destroy connection **/
Peer.prototype.destroy = function() {
    this.peer.destroy()
}

/** peer signal **/
Peer.prototype.signal = function(data) {
    this.peer.signal(data)
}

module.exports = Peer
