'use strict'
const express = require('express')
const parser = require('body-parser')
const cookie = require('cookie-parser')
const app = express()
const server = require('http').createServer(app)
const config = require('./serverConfig')
const serverUtils = require('./src/serverUtils')
const SocketController = require('./src/socketController')
const io = require('socket.io')(server , { wsEngine: 'ws' })

server.listen(config.port)

/** init socket controller **/
const socketController = new SocketController(io)

/** set body-parser to server **/
app.use(parser.urlencoded({ extended: true }))

/** set cookie-parser to server **/
app.use(cookie())

/** login page **/
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/user_content/login.html')
})

/** check authorization **/
app.post('/', (req, res) => {
    try {
        const { login, password } = req.body
        /** find user **/
        const user = socketController.users.find(user => user.login === login)
        /** if user exists and password isn't wrong **/
        if (serverUtils.validateServerUser(user, password)) {
            const authToken = serverUtils.generateAuthToken()
            socketController.authTokens[authToken] = user
            res.cookie('AuthToken', authToken)
            res.redirect('/main')
            console.log(`user ${user.login} has authorized, ${new Date()}`)
        }
        else {
            res.redirect('/')
            console.log(`authorisation failed with login ${login}, ${new Date()}`)
        }
    }
    catch (e) {
        console.error(`route error (/), ${new Date()}`)
        console.error(e)
    }
})

/** set authToken **/
app.use((req, res, next) => {
    try {
        const authToken = req.cookies['AuthToken']
        req.user = socketController.authTokens[authToken]
        next()
    }
    catch (e) {
        console.error(`route error (use), ${new Date()}`)
        console.error(e)
    }
})

/** admin page **/
app.get('/admin', (req, res) => {
    try {
        if (req.user && req.user.adminAccess)
            res.sendFile(__dirname  + '/user_content/admin.html')
        else
            res.redirect('/main')
    }
    catch (e) {
        console.error(`route error (/admin), ${new Date()}`)
        console.error(e)
    }
})

/** main page **/
app.get('/main', (req, res) => {
    try {
        if (req.user)
            res.sendFile(__dirname + '/user_content/index.html')
        else
            res.redirect('/')
    }
    catch (e) {
        console.error(`route error (/main), ${new Date()}`)
        console.error(e)
    }
})

/** user content **/
app.use(express.static(__dirname + '/user_content'))
/** screens **/
app.use(express.static(__dirname + '/screens'))
/** audio **/
app.use(express.static(__dirname + '/user_content/notification_audio'))
/** logs **/
app.use(express.static(__dirname + '/logs'))