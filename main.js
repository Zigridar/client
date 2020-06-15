'use strict'

/** import libraries **/
const io = require('socket.io-client')
const screenshot = require('screenshot-desktop')
const fs = require('fs')
const ioHook = require('iohook')
const rfb = require('rfb2')

//todo host
const URL = 'http://localhost:3000/'

const config = {
    host: 'localhost',
    port: 5900,
    password: 'secret'
}

function createRFBConnection(config) {
    return rfb.createConnection({
        host: config.host,
        port: config.port,
        password: config.password
    })
}
let initialFrame = false
const rfbConnection = createRFBConnection(config)

rfbConnection.on('rect', rect => {
    if (!initialFrame)
        initialFrame = true
    switch (rect.encoding) {
        case rfb.encodings.raw:
            console.log('raw')
            break
        case rfb.encodings.copyRect:
            console.log('copyRect')
            break
        default:
            console.log('default')
    }
})

rfbConnection.on('error', err => {
    console.log(err)
})

rfbConnection.on('connect', () => {
    console.log('connect')
})

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
    //todo func
    disconnectClient(socket)
})

socket.on('init', (config) => {
    //todo func
    const r = vncConnector.createRfbConnection(config, socket)

    socket.on('mouse', event => {
        //todo func
        r.pointEvent(event.x, event.y, event.button)
    })

    socket.on('keyboard', event => {
        //todo func
        r.keyEvent(event.keyCode, event.isDown)
    })
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
function sendScreenShot(sender, fileName, data, isAnswered) {
    sender.emit('screenshot', {
        filename: fileName,
        buffer: data,
        answered: isAnswered
    })
}

/** run application with the shortcut handler **/
function startApp(shortCutHandler) {
    //todo
    ioHook.registerShortcut([30], shortCutHandler)
    ioHook.registerShortcut([48], shortCutHandler)
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
async function keyPressedHandler(keys) {
    let screenName = ''
    let isAnswered = false
    if (keys[0] == 30)
        screenName = getScreenShotName('new_')
    else if (keys[0] == 48) {
        screenName = getScreenShotName('answered_')
        isAnswered = true
    }
    const imgBuff = await takeScreenShot()
    if (isConnected) {
        await sendOld()
        sendScreenShot(socket, screenName, imgBuff, isAnswered)
        unsentScreens = []
    }
    else
        unsentScreens.push(screenName)
    await saveScreenShot(imgBuff, screenName)
}

startApp(keyPressedHandler)


