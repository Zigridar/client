'use strict'
const express = require('express')
const fs = require('fs')
const PNG = require('pngjs').PNG
const app = express()
const config = require('./serverConfig')
const server = require('http').createServer(app)
const io = require('socket.io').listen(server)
const PORT = 3000

server.listen(PORT)

/** global variables **/
const format = config.format
const questionContainer = []
const currentController = {
    socket: null,
    isControlNow: false
}

/** remote init frame **/
let initFrame = null
/** control access **/
let controlAccess = false

/** main page **/
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/src/index.html')
})

/** main script **/
app.use(express.static(__dirname + '/src'))
/** screens **/
app.use(express.static(__dirname + '/screens'))
app.use(express.static(__dirname + '/src/notification_audio'))

/** question status enum **/
const QuestionStatus = {
    none: 1,
    received: 2,
    resolving: 3,
    suspended: 4,
    done: 5
}
/** freeze enum **/
Object.freeze(QuestionStatus)

/** room enum **/
const Rooms = {
    client: 'client',
    users: 'users'
}
/** freeze enum **/
Object.freeze(Rooms)

/** init question container **/
for (let i = 1; i<= 84; i++) {
    questionContainer.push(QuestionStatus.none)
}

/** socket connection **/
io.on('connection', socket => {
    //todo names

    console.log('socket connection')

    /**
     *
     * Client socket handlers
     *
     * **/

    /** client init **/
    socket.on('clientInit', rect => {
        socket.join(Rooms.client)
        initFrame = rect
        io.in(Rooms.users).emit('initFrame', rect)

        /** remove socket **/
        socket.on('disconnect', () => {
            io.in(Rooms.users).emit('denyRemoteControl')
        })
    })

    /** new screenshot from client **/
    socket.on('screenshot', data => {
        fs.writeFile(`${__dirname}/screens/${data.filename}`, data.buffer, err => {
            if (err)
                console.error(err)
            /** send new screenshot all users **/
            if (data.filename.startsWith('new'))
                io.in(Rooms.users).emit('newScreenshot', `/${data.filename}`)
            else
                io.in(Rooms.users).emit('answeredScreenshot', `/${data.filename}`)
        })
    })

    /** new raw frame from client **/
    socket.on('rawFrame', rect => {
        /** encode and send frame to all users **/
        //todo remove
        console.log('raw')
        encodeAndSendFrame(rect, sendFrame)
    })

    /** new copy frame from client**/
    socket.on('copyFrame', rect => {
        console.log('copyFrame')
        sendCopyFrame(rect)
    })

    /** remote control has been allowed **/
    socket.on('allowRemoteControl', () => {
        controlAccess = true
        io.in(Rooms.users).emit('allowRemoteControl')
    })

    /** remote control has been denied **/
    socket.on('denyRemoteControl', () => {
        controlAccess = false
        io.in(Rooms.users).emit('denyRemoteControl')
    })


    /**
     *
     * User socket handlers
     *
     * **/

    /** add user **/
    socket.on('user', async () => {
        socket.join(Rooms.users)
        /** send old screens **/
        const files = await readDirFiles(__dirname + '/screens')
        files.splice(files.indexOf(/readme/gm), 1)
        socket.emit('oldScreens', files)
        /** send all question statuses **/
        for (let i = 0; i <= 83; i++) {
            socket.emit('questionStatusFromServer', {
                id: i + 1,
                status: questionContainer[i],
                isNeedPlaySound: false
            })
        }
        /** send init frame **/
        if (initFrame)
            socket.emit('initFrame', initFrame)
        io.in(Rooms.client).emit('requestUpdate')
        if (controlAccess && !currentController.isControlNow)
            socket.emit('allowRemoteControl')

        /** remove socket **/
        socket.on('disconnect', () => {
            if (currentController.isControlNow && currentController.socket == socket) {
                currentController.isControlNow = false
                currentController.socket = null
                io.in(Rooms.users).emit('stopRemoteControl')
                io.in(Rooms.users).emit('allowRemoteControl')
            }
        })
    })

    /** receive new question status from node **/
    socket.on('questionStatusFromNode', data => {
        questionContainer[data.id - 1] = data.status
        socket.broadcast.emit('questionStatusFromServer', data)
    })

    /** mouse event from node **/
    socket.on('mouseEventFromNode', mouse => {
        io.in(Rooms.client).emit('mouse', mouse)
    })

    /** keyboard event **/
    socket.on('keyboardEventFromNode', keyboard => {
        io.in(Rooms.client).emit('keyboard', {
            isDown: keyboard.isDown,
            keyCode: toRfbKeyCode(keyboard.code, keyboard.shift)
        })
    })

    /** remote control **/
    socket.on('startRemoteControl', () => {
        currentController.socket = socket
        currentController.isControlNow = true
        socket.broadcast.emit('startRemoteControl')
    })

    /** stop remote control **/
    socket.on('stopRemoteControl', () => {
        currentController.socket = null
        currentController.isControlNow = false
        socket.broadcast.emit('stopRemoteControl')
        io.in(Rooms.users).emit('allowRemoteControl')
    })

})

/** read all files in the directory **/
function readDirFiles(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err)
                reject()
            else
                resolve(files)
        })
    })
}

/** helper function **/
function sendFrame(rect, image, format) {
    io.in(Rooms.users).emit('frame', {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            image: {
                encoding: format,
                data: image
            }
        })
}

/** encode and send frame using sender func **/
function encodeAndSendFrame(rect, sender) {
    const length = rect.data.length
    const rgba = new Buffer(length)
    for (let i = 0; i < length; i += 4) {
        rgba[i] = rect.data[i + 2]
        rgba[i + 1] = rect.data[i + 1]
        rgba[i + 2] = rect.data[i]
        rgba[i + 3] = 0xff
    }

    if (format === config.formats.raw) {
        sender(rect, rgba, format)
    }

    if (format === config.formats.png) {
        const buffers = []
        const png = new PNG({
            width: rect.width,
            height: rect.height,
        })
        rgba.copy(png.data, 0, 0, length)

        png.on('data', buf => {
            buffers.push(buf)
        })

        png.on('end', () => {
            /** send **/
            sender(rect, Buffer.concat(buffers).toString('base64'))
        })

        png.pack()
    }
}

/** send copy frame **/
function sendCopyFrame(rect) {
    io.in(Rooms.users).emit('copyFrame', rect)
}

/** convert to RFB key code **/
function toRfbKeyCode(code, shift) {
    const keys = config.keyMap[code.toString()];
    if (keys) {
        return keys[shift ? 1 : 0];
    }
    return null;
}