'use strict'
const express = require('express')
const fs = require('fs')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io').listen(server)
const PORT = 3000

server.listen(PORT)

/** main page **/
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/src/index.html')
})

/** main script **/
app.get('/index.js', (req, res) => {
    res.sendFile(__dirname + '/src/index.js')
})

/** socket connection **/
io.on('connection', socket => {

    console.log('connection')

    socket.on('screenshot', data => {
        fs.writeFile(`${__dirname}/screens/${data.filename}`, data.buffer, (err) => {
            //todo do something
            console.log('new screen')
        })
    })

    socket.on('disconnect', () => {
        console.log('disconnect')
    });

});