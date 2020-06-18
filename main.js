'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')
const rfb = require('rfb2')

//todo file
//todo keys
const config = {
    host: 'localhost',
    port: 5900,
    password: 'safon1242',
    serverUrl: 'http://localhost:3000/',
    newScreenshotBtns: [30],
    answeredScreenshotBtns: [48],
    startControlBtns: [12],
    stopControlBtns: [23]
}

//todo disable screenshot when remote control is enabled

/**
 * global variables
 *
 * */

/** connection status **/
let isConnected = false

/** unsent screens storage  **/
let unsentScreens = []

/** check initial rbc connection initial stream **/
let initialFrame = false

/** remote control permission **/
//todo test
let remoteControlPermission = true

/** init socket connection **/
const socket = io.connect(config.serverUrl, {
    reconnect: true
})

/** init RFB connection **/
const rfbConnection = rfb.createConnection({
    host: config.host,
    port: config.port,
    password: config.password,
    encodings: [rfb.encodings.raw]
})

/** update screen event **/
rfbConnection.on('rect', rect => {
    if (!initialFrame)
        initialFrame = true

    if (remoteControlPermission) {
        sendRawFrame(rect)
        //todo test
        console.log('update')
    }
})

/** RFB error **/
rfbConnection.on('error', err => {
    console.error('RFB ERROR')
    console.error(err)
})

/** RFB connect event **/
rfbConnection.on('connect', () => {
    console.log('RFB connection')
})

/** connection event **/
socket.on('connect', async () => {
    console.log('socket connection')
    isConnected = true
    await sendOld()
})

/** disconnect event **/
socket.on('disconnect', () => {
    console.error('socket has been disconnected')
    isConnected = false
})

/** mouse control listener **/
socket.on('mouse', mouse => {
    if (remoteControlPermission) {
        rfbConnection.pointerEvent(mouse.x, mouse.y, mouse.button)
        updateScreen()
    }
})

/** keyboard control listener **/
socket.on('keyboard', keyboard => {
    if (remoteControlPermission) {
        rfbConnection.keyEvent(keyboard.keyCode, keyboard.isDown)
        updateScreen()
    }
})

/** update screen (emit event 'rect') **/
function updateScreen() {
    if (initialFrame)
        rfbConnection.requestUpdate(false, 0, 0, rfbConnection.width, rfbConnection.height)
}

/** returns an arrayBuffer of desktop screenshot **/
function takeScreenShot() {
    return new Promise((resolve, reject) => {
        screenshot()
            .then(imgBuffer => {
                console.log('screenshot has been taken')
                resolve(imgBuffer)
            })
            .catch(err => {
                console.error(err)
                reject()
            })
    })
}

/** save local screenshot **/
function saveScreenShot(bufferedData, name) {
    return new Promise((resolve, reject) => {
        fs.writeFile('./screens/' + name, bufferedData, err => {
            if (err) {
                console.error(err)
                reject(err)
            }
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
            if (err) {
                console.error(err)
                reject()
            }
            else
                resolve(data)
        })
    })
}

/** send screenshot to recipient **/
function sendScreenShot(socket, fileName, data, isAnswered) {
    socket.emit('screenshot', {
        filename: fileName,
        buffer: data,
        answered: isAnswered
    })
}

/** run application with the shortcut handler **/
function startApp() {
    /** take new screenshot **/
    ioHook.registerShortcut(config.newScreenshotBtns, screenShotHandler)
    /** take answered screenshot **/
    ioHook.registerShortcut(config.answeredScreenshotBtns, screenShotHandler)
    /** start remote control signal **/
    ioHook.registerShortcut(config.startControlBtns, remoteControlHandler)
    /** stop remote control signal **/
    ioHook.registerShortcut(config.stopControlBtns, remoteControlHandler)
    /** start listening **/
    ioHook.start()
}

/** returns name for new screenshot based on current date-time **/
function getScreenShotName(pre) {
    const now = new Date()
    const hours = `0${now.getHours()}.`.slice(-3)
    const minutes = `0${now.getMinutes()}.`.slice(-3)
    const seconds = `0${now.getSeconds()}`.slice(-2)
    return `${pre + hours + minutes + seconds}.png`
}

/** send old screens **/
async function sendOld() {
    for (const screen of unsentScreens) {
        const buf = await readScreenShotByName(screen)
        if (screen.startsWith('new'))
            sendScreenShot(socket, screen, buf, false)
        else
            sendScreenShot(socket, screen, buf, true)
    }
}

/** The main handler **/
async function screenShotHandler(keys) {
    /** local variables **/
    let screenName = ''
    let isAnswered = false
    /** new screenshot shortcut **/
    if (arrayEqual(config.newScreenshotBtns, keys))
        screenName = getScreenShotName('new_')
    /** answered screenshot s **/
    else if (arrayEqual(config.answeredScreenshotBtns, keys)) {
        screenName = getScreenShotName('answered_')
        isAnswered = true
    }
    /** screenshot buffer **/
    const imgBuff = await takeScreenShot()
    if (isConnected) {
        await sendOld()
        sendScreenShot(socket, screenName, imgBuff, isAnswered)
        unsentScreens = []
    }
    else
        unsentScreens.push(screenName)
    /** save local any new screen **/
    await saveScreenShot(imgBuff, screenName)
}

/** remote control shortcut handler **/
function remoteControlHandler(keys) {
    /** allow remote control **/
    if (arrayEqual(config.startControlBtns, keys)) {
        remoteControlPermission = true
        socket.emit('allowRemoteControl')
    }
    /** deny remote control **/
    else if (arrayEqual(config.startControlBtns, keys)) {
        remoteControlPermission = false
        socket.emit('denyRemoteControl')
    }
}

/** send raw frame (parsing to PNG on server side) **/
function sendRawFrame(rect) {
    socket.emit('rawFrame', rect)
}

/** helper func **/
function arrayEqual(arr_1, arr_2) {
    if (!arr_1 || !arr_2)
        return false

    if(arr_1.length !== arr_2.length)
        return false

    arr_1.forEach((item, i) => {
        if (item !== arr_2[i])
            return false
    })

    return true
}
//
setInterval(updateScreen, 300)

/** The main function**/
startApp()


