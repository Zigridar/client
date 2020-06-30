'use strict'
const io = require('socket.io-client')
const config = require('./clientConfig')
const Peer = require('./Peer2')

const socket = io.connect(config.serverUrl, {
    forceNew: true,
    transports: ['websocket'],
    allowUpgrades: false,
    pingTimeout: 30000
})

socket.on('connect', () => {
    console.log('socket connection')
    const peer = new Peer({
        initiator: true,
        trickle: false
    })

    peer.on('error', err => {
        console.log(err)
    })

    peer.on('connect', () => {
        console.log('connect')
    })

    peer.on('signal', data => {
        console.log('signal')
        socket.emit('offerFromClient', data)
    })

    socket.on('answerFromUser', answer => {
        peer.signal(answer)
    })

})