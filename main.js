'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')

/** returns an arrayBuffer of desktop screenshot **/
function takeScreenShot() {
    return new Promise((resolve, reject) => {
        screenshot()
            .then(imgBuffer => {
                console.log('screenshot has been taken')
                resolve(imgBuffer)
            })
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
            else {
                console.log(`screenshot has been saved on path: ${path}`)
                resolve()
            }
        })
    })
}

/** run application with the shortcut handler **/
function startApp(shortCutHandler) {
    /** ctrl + left shift **/
    ioHook.registerShortcut([29, 42], shortCutHandler)
    ioHook.start()
}

/** returns name for new screenshot based on current date-time **/
function getScreenShotName() {
    return `${(new Date).toLocaleString().replace(', ', '-')}.png`
}

/** The main handler **/
async function keyPressedHandler() {
    const imgBuff = await takeScreenShot()
    await saveScreenShot(imgBuff, getScreenShotName())
}

startApp(keyPressedHandler)



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

