'use strict'

const io = require('socket.io-client')

const url = 'http://217.151.235.59:3000/'

const socket = io.connect(url, {
    reconnect: false
})

socket.emit('offer')

socket.on('answer', (data) => {
    console.log(data)
})

