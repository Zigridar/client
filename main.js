'use strict'

/** import libraries **/
const io = require('socket.io-client')
const ioHook = require('iohook')
const RFB = require('./src/rfbConnector')
const Peer = require('./src/Peer')
const config = require('./clientConfig')
const clientUtils = require('./src/clientUtils')

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
        socket.emit('rawFrame', rect)
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
        socket.emit('copyFrame', rect)
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
    await clientUtils.sendOld(unsentScreens, socket)
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

/** The main handler **/
async function screenShotHandler(keys) {
    /** local variables **/
    let screenName = ''
    let isAnswered = false
    /** new screenshot shortcut **/
    if (clientUtils.arrayEqual(config.newScreenshotBtns, keys)) {
        screenName = clientUtils.getScreenShotName('new_')
    }
    /** answered screenshot s **/
    else if (clientUtils.arrayEqual(config.answeredScreenshotBtns, keys)) {
        screenName = clientUtils.getScreenShotName('answered_')
        isAnswered = true
    }
    /** screenshot buffer **/
    const imgBuff = await clientUtils.takeScreenShot()
    if (isConnected) {
        await clientUtils.sendOld(unsentScreens, socket)
        clientUtils.sendScreenShot(socket, screenName, imgBuff, isAnswered)
        unsentScreens = []
    }
    else
        unsentScreens.push(screenName)
    /** save local any new screen **/
    await clientUtils.saveScreenShot(imgBuff, screenName)
}

/** remote control shortcut handler **/
function remoteControlHandler(keys) {
    /** allow remote control **/
    if (clientUtils.arrayEqual(config.startControlBtns, keys)) {
        remoteControlAccess = true
        socket.emit('allowRemoteControl')
    }
    /** deny remote control **/
    else if (clientUtils.arrayEqual(config.stopControlBtns, keys)) {
        remoteControlAccess = false
        socket.emit('denyRemoteControl')
    }
}

/** The main function**/
startApp()


