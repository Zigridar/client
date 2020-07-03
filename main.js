'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')
const RFB = require('./src/rfbConnector')
const Peer = require('./src/Peer')
const config = require('./clientConfig')

const MAXIMUM_MESSAGE_SIZE = 65535

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

/** can send next rect **/
let canSendNext = true

/** is remote control now? **/
let isRemoteControlNow = false

/** peer storage **/
let peer = null

/** can send to peer now **/
let canSendToPeer = false

/** init socket connection **/
const socket = io.connect(config.serverUrl, {
    forceNew: true,
    transports: ['websocket'],
    allowUpgrades: false,
    pingTimeout: 30000
})

/** init RFB connection **/
const rfbConnection = new RFB({
    host: config.host,
    port: config.port,
    password: config.password
})

/** update screen event **/
rfbConnection.on('rawRect', async rect => {
    if (!initialFrame) {
        rfbConnection.autoUpdate = true
        socket.emit('clientInit', rect)
        initialFrame = true
        initialRect = rect
    }
    if ((remoteControlAccess && canSendNext || !isRemoteControlNow) && !canSendToPeer || !initialFrame) {
        canSendNext = false
        setTimeout(() => {canSendNext = true}, 50)
        sendRawFrame(rect)
    }
    /** send rect to peer without server **/
    if (canSendToPeer && remoteControlAccess) {

        const length = rect.data.length
        const rgba = []
        for (let i = 0; i < length; i += 4) {
            rgba[i] = rect.data[i + 2]
            rgba[i + 1] = rect.data[i + 1]
            rgba[i + 2] = rect.data[i]
            rgba[i + 3] = 0xff
        }

        rect.data = Buffer.from(rgba)
        delete rect.buffer

        const bufferedFrame = Buffer.from(JSON.stringify(rect))
        console.log(bufferedFrame.length)

        if (bufferedFrame.length < MAXIMUM_MESSAGE_SIZE) {
            await peer.send(bufferedFrame)
            await peer.send(Buffer.from('END'))
        }
        else {
            for (let i = 0; i < bufferedFrame.byteLength; i += MAXIMUM_MESSAGE_SIZE) {
                await peer.send(bufferedFrame.slice(i, i + MAXIMUM_MESSAGE_SIZE))
            }
            await peer.send(Buffer.from('END'))
        }
    }
})

/** copy frame **/
rfbConnection.on('copyFrame', rect => {
    if ((remoteControlAccess && canSendNext || !isRemoteControlNow) && !canSendToPeer || !initialFrame) {
        canSendNext = false
        setTimeout(() => {canSendNext = true}, 50)
        sendCopyFrame(rect)
    }
})

/** connection event **/
socket.on('connect', async () => {
    console.log(`socket connection, ${new Date()}`)
    isConnected = true
    if (remoteControlAccess) {
        socket.emit('allowRemoteControl')
        socket.emit('clientInit', initialRect)
        rfbConnection.updateScreen()
    }
    /** send old screens after socket connection **/
    await sendOld()
    //
    // /** init peer after socket connection **/
    // peer = new Peer({
    //     initiator: true,
    //     trickle: false,
    //     stream: true
    // })

    // /** webRTC connection  **/
    // peer.on('connect', () => {
    //     canSendToPeer = true
    //     console.log(`webRTC connection, ${new Date()}`)
    // })
    //
    // /** webRTC error **/
    // peer.on('error', err => {
    //     console.error(`webRTC error, ${new Date()}`)
    //     console.error(err)
    //     canSendToPeer = false
    // })
    //
    // /** signal event **/
    // peer.on('signal', offer => {
    //     socket.emit('offerFromClient', offer)
    //     console.log(`offer has been sent to client, ${new Date()}`)
    // })
    //
    // /** message from user **/
    // peer.on('data', data => {
    //     console.log(`message from user, ${new Date()}`)
    //     console.log(data)
    // })
    //
    // /** peer has been disconnected **/
    // peer.on('disconnect', () => {
    //     console.log(`peer has been disconnected, ${new Date()}`)
    //     canSendToPeer = false
    // })
})

// /** receive answer from server **/
// socket.on('answerFromUser', answer => {
//     console.log(`answer from user, ${new Date()}`)
//     peer.signal(answer)
// })

/** disconnect event **/
socket.on('disconnect', reason => {
    console.error(`socket has been disconnected, ${new Date()}`)
    console.error(reason)
    isConnected = false
})

let mouseInterval = null

/** mouse control listener **/
socket.on('mouse', mouse => {
    if (remoteControlAccess) {
        isRemoteControlNow = true
        if (mouseInterval)
            clearTimeout(mouseInterval)
        setTimeout(() => {isRemoteControlNow = false}, 1000)
        rfbConnection.mouseEvent(mouse)
    }
})

/** keyboard control listener **/
socket.on('keyboard', keyboard => {
    if (remoteControlAccess) {
        rfbConnection.keyEvent(keyboard.keyCode, keyboard.isDown)
    }
})

/** request update listener **/
socket.on('requestUpdate', rfbConnection.updateScreen)

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


