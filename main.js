'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')
const rfb = require('rfb2')
const config = require('./clientConfig')

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
let initialRect = null

/** remote control permission **/
let remoteControlAccess = false

/** init socket connection **/
const socket = io.connect(config.serverUrl, {
    forceNew: true,
    transports: ['websocket'],
    allowUpgrades: false,
    pingTimeout: 30000
})

/** init RFB connection **/
const rfbConnection = rfb.createConnection({
    host: config.host,
    port: config.port,
    password: config.password
})

/** update screen event **/
rfbConnection.on('rect', rect => {
    if (!initialFrame) {
        rfbConnection.autoUpdate = true
        socket.emit('clientInit', rect)
        initialFrame = true
        initialRect = rect
    }
    if (remoteControlAccess || !initialFrame) {
        console.log(`rect, ${new Date()}`)
        switch (rect.encoding) {
            case rfb.encodings.raw:
                sendRawFrame(rect)
                break
            case rfb.encodings.copyRect:
                sendCopyFrame(rect)
                break
        }
    }
})

/** RFB error **/
rfbConnection.on('error', err => {
    console.error(`RFB ERROR, ${new Date()}`)
    console.error(err)
})

/** RFB connect event **/
rfbConnection.on('connect', () => {
    rfbConnection.autoUpdate = true
    console.log(`RFB connection, ${new Date()}`)
})

/** connection event **/
socket.on('connect', async () => {
    console.log(`socket connection, ${new Date()}`)
    isConnected = true
    if (remoteControlAccess) {
        socket.emit('allowRemoteControl')
        socket.emit('clientInit', initialRect)
        updateScreen()
    }
    await sendOld()
})

/** disconnect event **/
socket.on('disconnect', reason => {
    console.error(`socket has been disconnected, ${new Date()}`)
    console.error(reason)
    isConnected = false
})

/** mouse control listener **/
socket.on('mouse', mouse => {
    if (remoteControlAccess) {
        rfbConnection.pointerEvent(mouse.x, mouse.y, mouse.button)
    }
})

/** keyboard control listener **/
socket.on('keyboard', keyboard => {
    if (remoteControlAccess) {
        rfbConnection.keyEvent(keyboard.keyCode, keyboard.isDown)
    }
})

/** request update listener **/
socket.on('requestUpdate', updateScreen)

/** returns an arrayBuffer of desktop screenshot **/
function takeScreenShot() {
    return new Promise((resolve, reject) => {
        screenshot()
            .then(imgBuffer => {
                console.log(`screenshot has been taken, ${new Date()}`)
                resolve(imgBuffer)
            })
            .catch(err => {
                console.error(`taking screenshot failed, ${new Date()}`)
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
                console.error(`saving failed, ${new Date()}`)
                console.error(err)
                reject(err)
            }
            else {
                console.log(`screenshot has been saved on path: ${name}, ${new Date()}`)
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
                console.error(`reading screenshot by name failed, ${new Date()}`)
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
    console.log(`start application, ${new Date()}`)
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
    console.log(`sending old screenshots, ${new Date()}`)
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
    if (arrayEqual(config.newScreenshotBtns, keys)) {
        screenName = getScreenShotName('new_')
    }
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
        remoteControlAccess = true
        socket.emit('allowRemoteControl')
    }
    /** deny remote control **/
    else if (arrayEqual(config.stopControlBtns, keys)) {
        remoteControlAccess = false
        socket.emit('denyRemoteControl')
    }
}

/** send raw frame (parsing on server side) **/
function sendRawFrame(rect) {
    socket.emit('rawFrame', rect)
}

/** send copyFrame **/
function sendCopyFrame(rect) {
    socket.emit('copyFrame', rect)
}

/** helper func **/
function updateScreen() {
    rfbConnection.requestUpdate(false,0, 0, rfbConnection.width, rfbConnection.height)
}

/** helper func **/
function arrayEqual(arr_1, arr_2) {
    let res = true
    if (!arr_1 || !arr_2)
        return false

    if(arr_1.length !== arr_2.length)
        return false

    arr_1.forEach((item, i) => {
        if (item != arr_2[i])
            res = false
    })

    return res
}

/** The main function**/
startApp()


