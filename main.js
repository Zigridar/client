'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')

//todo host
const URL = 'http://localhost:3000/'

/** connection status **/
let isConnected = false

/** unsent screens storage  **/
let unsentScreens = []

/** init socket connection **/
const socket = io.connect(URL, {
    reconnect: true
})

/** connection event **/
socket.on('connect', async () => {
    console.log('connect')
    isConnected = true
    await sendOld()
})

/** disconnect event **/
socket.on('disconnect', () => {
    console.log('disconnect')
    isConnected = false
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

/** read screen from screens by name **/
function readScreenShotByName(name) {
    return new Promise((resolve, reject) => {
        fs.readFile(`${__dirname}/screens/${name}`, (err, data) => {
            if (err)
                reject()
            else
                resolve(data)
        })
    })
}

/** send screenshot to recipient **/
function sendScreenShot(sender, fileName, data) {
    sender.emit('screenshot', {
        filename: fileName,
        buffer: data
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

/** send old screens **/
async function sendOld() {
    for (const screen of unsentScreens) {
        const buf = await readScreenShotByName(screen)
        sendScreenShot(socket, screen, buf)
    }
}

/** The main handler **/
async function keyPressedHandler() {
    const screenName = getScreenShotName()
    const imgBuff = await takeScreenShot()
    if (isConnected) {
        await sendOld()
        sendScreenShot(socket, screenName, imgBuff)
        unsentScreens = []
    }
    else
        unsentScreens.push(screenName)
    await saveScreenShot(imgBuff, screenName)
}

startApp(keyPressedHandler)


