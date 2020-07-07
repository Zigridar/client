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

/** global variables **/

/** user container **/
const authTokens = {};

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
    const { login, password } = req.body
    const hashedPassword = serverUtils.getHashedPassword(password)
    /** find user **/
    const user = config.users.find(user => user.login === login)
    /** if user exists and password isn't wrong **/
    if (user && hashedPassword === user.passHash) {
        const authToken = serverUtils.generateAuthToken()
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
})

/** admin page **/
app.get('/admin', (req, res) => {

    if (req.user && req.user.admin)
        res.sendFile(__dirname  + '/user_content/admin.html')
    else
        res.redirect('/main')

})

/** main page **/
app.get('/main', (req, res) => {
    if (req.user)
        res.sendFile(__dirname + '/user_content/index.html')
    else
        res.redirect('/')
})

/** user content **/
app.use(express.static(__dirname + '/user_content'))
/** screens **/
app.use(express.static(__dirname + '/screens'))
/** audio **/
app.use(express.static(__dirname + '/user_content/notification_audio'))

/** init socket controller **/
const socketController = new SocketController(io)