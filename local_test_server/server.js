'use strict'
const express = require('express')
const fs = require('fs')
const PNG = require('pngjs').PNG
const app = express()
const parser = require('body-parser')
const crypto = require('crypto')
const cookie = require('cookie-parser')
const config = require('./serverConfig')
const server = require('http').createServer(app)
const io = require('socket.io').listen(server)

server.listen(config.port)

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
/** client connection status **/
let clientConnectionStatus = false

/** user container **/
const authTokens = {};

/** set body-parser to server **/
app.use(parser.urlencoded({ extended: true }))

/** set cookie-parser to server **/
app.use(cookie())

/** login page **/
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/src/login.html')
})

/** check authorization **/
app.post('/', (req, res) => {
    const { login, password } = req.body
    const hashedPassword = getHashedPassword(password)
    /** find user **/
    const user = config.users.find(user => user.login === login)
    /** if user exists and password isn't wrong **/
    if (user && hashedPassword === user.passHash) {
        const authToken = generateAuthToken()
        authTokens[authToken] = user
        res.cookie('AuthToken', authToken)
        res.redirect('/main')
        console.log(`user ${user.login} has authorized, ${new Date()}`)
    }
    else {
        res.redirect('/')
        console.log(`authorisation failed with login ${login}, ${new Date()}`)
    }
})

app.use((req, res, next) => {
    const authToken = req.cookies['AuthToken']
    req.user = authTokens[authToken]
    next()
});

/** main page **/
app.get('/main', (req, res) => {
    if (req.user)
        res.sendFile(__dirname + '/src/index.html')
    else
        res.redirect('/')
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
for (let i = 1; i<= config.questionCount; i++) {
    questionContainer.push(QuestionStatus.none)
}

/** socket connection **/
io.on('connection', socket => {
    //todo names
    /**
     *
     * Client socket handlers
     *
     * **/

    /** client init **/
    socket.on('clientInit', rect => {
        clientConnectionStatus = true
        socket.join(Rooms.client)
        initFrame = rect
        io.in(Rooms.users).emit('initFrame', rect)
        io.in(Rooms.users).emit('clientHasBeenConnected')
        console.log(`client has been connected, ${new Date()}`)

        /** remove socket **/
        socket.on('disconnect', () => {
            clientConnectionStatus = false
            controlAccess = false
            console.log('client has been disconnected')
            io.in(Rooms.users).emit('denyRemoteControl')
            io.in(Rooms.users).emit('clientHasBeenDisconnected')
            console.log(`client has been disconnected, ${new Date()}`)
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
            console.log(`new screenshot: ${data.filename}, ${new Date()}`)
        })
    })

    /** new raw frame from client **/
    socket.on('rawFrame', rect => {
        /** encode and send frame to all users **/
        encodeAndSendFrame(rect, sendFrame)
    })

    /** new copy frame from client**/
    socket.on('copyFrame', rect => {
        sendCopyFrame(rect)
    })

    /** remote control has been allowed **/
    socket.on('allowRemoteControl', () => {
        controlAccess = true
        io.in(Rooms.users).emit('allowRemoteControl')
        console.log(`allow remote control, ${new Date()}`)
    })

    /** remote control has been denied **/
    socket.on('denyRemoteControl', () => {
        controlAccess = false
        io.in(Rooms.users).emit('denyRemoteControl')
        console.log(`deny remote control, ${new Date()}`)
    })


    /**
     *
     * User socket handlers
     *
     * **/

    /** add user **/
    socket.on('user', async () => {
        socket.join(Rooms.users)
        console.log(`new user socket has been connected ${new Date()}`)
        /** send old screens **/
        const files = await readDirFiles(__dirname + '/screens')
        files.splice(files.indexOf(/readme/gm), 1)
        socket.emit('oldScreens', files)
        /** send all question statuses **/
        for (let i = 0; i <= questionContainer.length; i++) {
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
        /** send client connection status to new socket **/
        if (clientConnectionStatus)
            socket.emit('clientHasBeenConnected')
        else
            socket.emit('clientHasBeenDisconnected')

        /** remove socket **/
        socket.on('disconnect', () => {
            console.log(`user socket has been disconnected, ${new Date()}`)
            if (currentController.isControlNow && currentController.socket == socket) {
                currentController.isControlNow = false
                currentController.socket = null
                io.in(Rooms.users).emit('stopRemoteControl')
                io.in(Rooms.users).emit('allowRemoteControl')
                console.log(`stop remote control, ${new Date()}`)
            }
        })
    })

    /** receive new question status from node **/
    socket.on('questionStatusFromNode', data => {
        questionContainer[data.id - 1] = data.status
        socket.broadcast.emit('questionStatusFromServer', data)
        console.log(`question ${data.id}, status: ${data.status}, ${new Date()}`)
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
        console.log(`start remote control, ${new Date()}`)
    })

    /** stop remote control **/
    socket.on('stopRemoteControl', () => {
        currentController.socket = null
        currentController.isControlNow = false
        socket.broadcast.emit('stopRemoteControl')
        io.in(Rooms.users).emit('allowRemoteControl')
        console.log(`stop remote control, ${new Date()}`)
    })

    /** remove screens (new or answered) **/
    socket.on('removeScreens', removeScrees)

    /** reset question statuses **/
    socket.on('resetQuestions', () => {
        for (let i = 0; i < questionContainer.length; i++) {
            questionContainer[i] = QuestionStatus.none
            io.in(Rooms.users).emit('questionStatusFromServer', {
                id: i + 1,
                status: questionContainer[i],
                isNeedPlaySound: false
            })
        }
        console.log(`reset questions, ${new Date()}`)
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
    return null
}

/** returns hash of the password **/
function getHashedPassword(password) {
    const sha256 = crypto.createHash('sha256')
    const hash = sha256.update(password).digest('base64')
    return hash
}

/** auth token for user session **/
function generateAuthToken() {
    return crypto.randomBytes(30).toString('hex')
}

/** remove screens **/
async function removeScrees(isNew) {
    let files = await readDirFiles(__dirname + '/screens')

    if (isNew)
        files = files.filter(fileName => fileName.startsWith('new'))
    else
        files = files.filter(fileName => fileName.startsWith('answered'))

    files.forEach(fileName => {
        fs.unlink(__dirname + `/screens/${fileName}`, () => {})
    })

    if (isNew)
        io.in(Rooms.users).emit('newScreensIsDeleted')
    else
        io.in(Rooms.users).emit('answeredScreensIsDeleted')
    console.log(`delete screens, isNew: ${isNew}, ${new Date()}`)
}