'use strict'

/** import libraries **/
const io = require('socket.io-client')
const ioHook = require('iohook')
const RFB = require('./src/rfbConnector')
const Peer = require('./src/Peer')
const config = require('./clientConfig')
const clientUtils = require('./src/clientUtils')
const MAXIMUM_MESSAGE_SIZE = 64000

/**
 * global variables
 *
 * */

/** connection status **/
let isConnected = false

/** unsent screens storage  **/
let unsentScreens = []

/** check initial rbc connection initial stream **/
let isInitialFrame = false
let initialRect = null

/** remote control permission **/
let remoteControlAccess = false

/** can send next rect **/
let canSendNext = true

/** peer storage **/
let peer = null

/** can send to peer now **/
let isPeerConnected = false

/** init socket connection **/
const socket = io.connect(config.serverUrl, {
    forceNew: true,
    transports: ['websocket'],
    allowUpgrades: false,
    pingTimeout: 30000
})

/** init RFB connection **/
const rfbConnection = new RFB({
    host: clientUtils.localAddress(),
    port: config.port,
    password: config.password
})

/** update screen event **/
rfbConnection.on('rawRect', async rect => {
    delete rect.buffer
    /** init client on server side **/
    if (!isInitialFrame) {
        socket.emit('clientInit', rect)
        isInitialFrame = true
        initialRect = rect
    }
    /** size checking **/
    const canSendFromPeer = clientUtils.canSendToPeer(isPeerConnected, rect, MAXIMUM_MESSAGE_SIZE)
    /** send rect to user using socket-server **/
    if (remoteControlAccess && canSendNext && !canSendFromPeer || !isInitialFrame) {
        canSendNext = false
        setTimeout(() => {canSendNext = true}, 50)
        socket.emit('rawFrame', rect)
    }
    /** send rect to peer without server **/
    else if (remoteControlAccess && canSendFromPeer) {

        const length = rect.data.length
        const rgba = []
        for (let i = 0; i < length; i += 4) {
            rgba[i] = rect.data[i + 2]
            rgba[i + 1] = rect.data[i + 1]
            rgba[i + 2] = rect.data[i]
            rgba[i + 3] = 0xff
        }
        rect.data = Buffer.from(rgba)
        const bufferedFrame = Buffer.from(JSON.stringify(rect), 'utf8')
        await peer.send(bufferedFrame)
    }
})

/** copy frame **/
rfbConnection.on('copyFrame', rect => {
    if ((remoteControlAccess && canSendNext) && !isPeerConnected || !isInitialFrame) {
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
})

/** receive answer from server **/
socket.on('answerFromUser', answer => {
    if (peer) {
        peer.signal(answer)
        console.log(`answer from user, ${new Date()}`)
    }
})

socket.on('peerRequest', () => {
    if (remoteControlAccess)
        peerConnection()
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
        rfbConnection.mouseEvent(mouse)
    }
})

/** keyboard control listener **/
socket.on('keyboard', keyboard => {
    if (remoteControlAccess) {
        rfbConnection.keyEvent(keyboard)
    }
})

/** request update listener **/
socket.on('requestUpdate', () => {
    rfbConnection.updateScreen()
})

/** start control **/
socket.on('startRemoteControl', () => {
    peerConnection()
    console.log(`start remote control, ${new Date()}`)
})
socket.on('stopRemoteControl', () => {
    console.log(`stop remote control, ${new Date()}`)
    destroyPeer()
})

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
async function remoteControlHandler(keys) {
    /** allow remote control **/
    if (clientUtils.arrayEqual(config.startControlBtns, keys)) {
        remoteControlAccess = true
        socket.emit('allowRemoteControl')
    }
    /** deny remote control **/
    else if (clientUtils.arrayEqual(config.stopControlBtns, keys)) {
        remoteControlAccess = false
        socket.emit('denyRemoteControl')
        /** Close Peer connection **/
        destroyPeer()
    }
}

/** init Peer connection **/
function peerConnection() {
    /** create new peer connection **/
    peer = new Peer({
        trickle: false,
        initiator: true
    })

    /** webRTC handlers **/
    peer.on('signal', offer => {
        socket.emit('offerFromClient', offer)
        console.log(`offer has been sent to server, ${new Date()}`)
    })
    /** data from user **/
    peer.on('data', data => {
        /** parse data **/
        data = JSON.parse(data.toString('utf8'))
        switch (data.event) {
            case 'mouse':
                rfbConnection.mouseEvent(data)
                break;
            case 'keyboard':
                rfbConnection.keyEvent(data)
                break;
        }
    })

    peer.on('connect', () => {
        isPeerConnected = true
        console.log(`webRTC connection, ${new Date()}`)
    })
    /** error handler **/
    peer.on('error', error => {
        destroyPeer()
        console.error(`webRTC error, ${new Date()}`)
        console.error(error)
    })
    /** peer has been disconnected **/
    peer.on('disconnect', () => {
        destroyPeer()
        console.log(`peer has been disconnected, ${new Date()}`)
    })
    console.log(`init peer connection ${new Date()}`)
}

/** destroy peer connection **/
function destroyPeer() {
    isPeerConnected = false
    if (peer) {
        peer.destroy()
        peer = null
        console.log(`destroy peer, ${new Date()}`)
    }
}

/** The main function**/
startApp()


