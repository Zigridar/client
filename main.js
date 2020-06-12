'use strict'

const io = require('socket.io-client')

const screenshot = require('screenshot-desktop')
const fs = require('fs')

/** return an arrayBuffer of desktop screenshot **/
function takeScreenShot() {
    return new Promise((resolve, reject) => {
        screenshot()
            .then(imgBuffer => resolve(imgBuffer))
            .catch(err => {
                reject(err)
            })
    })
}

/** save local screenshot **/
function saveScreenShot(bufferedData, path) {
    return new Promise((resolve, reject) => {
        fs.writeFile(path, bufferedData, err => {
            if (err)
                reject(err)
            else
                resolve()
        })
    })
}

//todo
// const url = 'todo'
//
// const socket = io.connect(url, {
//     reconnect: false
// })
//
// socket.emit('offer')
//
// socket.on('answer', (data) => {
//     console.log(data)
// })

