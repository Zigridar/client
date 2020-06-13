'use strict'
const express = require('express')
const fs = require('fs')
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

let student = null
const users = []

/** socket connection **/
io.on('connection', socket => {

    console.log('connection')

    /** add user **/
    socket.on('user', async () => {
        users.push(socket)
        /** send old screens **/
        const files = await readDirFiles(__dirname + '/screens')
        files.splice(files.indexOf(/readme/gm), 1)
        socket.emit('oldScreens', files)
    })

    /** new screenshot from student **/
    socket.on('screenshot', data => {
        if (!student)
            student = socket
        fs.writeFile(`${__dirname}/screens/${data.filename}`, data.buffer, err => {
            /** send new screenshot all users **/
            users.forEach(user => {
                if (data.filename.startsWith('new'))
                    user.emit('newScreenshot', `/${data.filename}`)
                else
                    user.emit('answeredScreenshot', `/${data.filename}`)
            })
        })
    })

    /** remove socket **/
    socket.on('disconnect', () => {
        const index = users.indexOf(socket)
        if (index >=0)
            users.splice(index, 1)
        else if (socket === student)
            student = null
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