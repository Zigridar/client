'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')

//todo host
const URL = 'http://localhost:3000/'

/** init socket connection **/
const socket = io.connect(URL, {
    reconnect: true
})


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
function saveScreenShot(bufferedData, name) {
    return new Promise((resolve, reject) => {
        fs.writeFile('./screens/' + name, bufferedData, err => {
            if (err)
                reject(err)
            else {
                console.log(`screenshot has been saved on path: ${name}`)
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
    const screenName = getScreenShotName()
    const imgBuff = await takeScreenShot()
    socket.emit('screenshot', {
        filename: screenName,
        buffer: imgBuff
    })
    await saveScreenShot(imgBuff, screenName)
}

startApp(keyPressedHandler)


