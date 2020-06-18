'use strict'
const express = require('express')
const fs = require('fs')
const PNG = require('pngjs').PNG
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io').listen(server)
const PORT = 3000

server.listen(PORT)

/** main page **/
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/src/index.html')
})

/** main script **/
app.use(express.static(__dirname + '/src'))
/** screens **/
app.use(express.static(__dirname + '/screens'))
app.use(express.static(__dirname + '/src/notification_audio'))

/** global variables **/
const questionContainer = []

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

/** init question container **/
for (let i = 1; i<= 84; i++) {
    questionContainer.push(QuestionStatus.none)
}

/** socket connection **/
io.on('connection', socket => {
    //todo delete files
    //todo names

    console.log('socket connection')

    /** add user **/
    socket.on('user', async () => {
        socket.join('users')
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
    })

    /**
     *
     * Client socket handlers
     *
     * **/

    /** new screenshot from client **/
    socket.on('screenshot', data => {
        socket.join('client')
        fs.writeFile(`${__dirname}/screens/${data.filename}`, data.buffer, err => {
            if (err)
                console.error(err)
            /** send new screenshot all users **/
            if (data.filename.startsWith('new'))
                io.to('users').emit('newScreenshot', `/${data.filename}`)
            else
                io.to('users').emit('answeredScreenshot', `/${data.filename}`)
        })
    })

    /** new raw frame from client **/
    socket.on('rawFrame', rect => {
        /** encode and send frame to all users **/
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
        io.to('users').emit('allowRemoteControl')
    })

    /** remote control has been denied **/
    socket.on('denyRemoteControl', () => {
        io.to('users').emit('denyRemoteControl')
    })


    /**
     *
     * User socket handlers
     *
     * **/

    /** receive new question status from node **/
    socket.on('questionStatusFromNode', data => {
        questionContainer[data.id - 1] = data.status
        socket.broadcast.emit('questionStatusFromServer', data)
    })

    /** mouse event from node **/
    socket.on('mouseEventFromNode', mouse => {
        io.to('client').emit('mouse', mouse)
    })

    /** keyboard event **/
    socket.on('keyboardEventFromNode', keyboard => {
        io.to('client').emit('keyboard', keyboard)
    })

    /** remote control **/
    socket.on('startRemoteControl', () => {
        io.to('users').emit('startRemoteControl')
    })

    /** stop remote control **/
    socket.on('stopRemoteControl', () => {
        io.to('users').emit('stopRemoteControl')
    })

    /** remove socket **/
    socket.on('disconnect', () => {
        socket.leave('users')
        socket.leave('client')
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
function sendFrame(rect, image) {
    io.to('users').emit('rawFrame', {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        image: image
    })
    console.log('update')
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

/** send copy frame **/
function sendCopyFrame(rect) {

}

/** delete screenshot **/
function deleteScreen(fileName) {
    fs.unlink(__dirname + `/${fileName}`, err => {
        if (err)
            console.error(err)
    })
}