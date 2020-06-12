'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')

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

/** run application with the shortcut handler **/
function startApp(shortCutHandler) {
    /** ctrl + left shift **/
    ioHook.registerShortcut([29, 42], shortCutHandler)
    ioHook.start()
}

/** test function **/
function testFoo() {
    console.log('foo')
}

startApp(testFoo)



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

