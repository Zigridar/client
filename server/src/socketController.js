'use strict'

const serverUtils = require('./serverUtils')
const config = require('../serverConfig')

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

/** constructor **/
function SocketController(io) {
    this.io = io
    this.clientConnectionStatus = false
    this.initFrame = null
    this.controlAccess = false
    this.currentUser = null
    this.questionContainer = []
    this.initFrame = null
    this.Rooms = {
        client: 'client',
        users: 'users'
    }
    this.initQuestionContainer()
    this.init()
}

/** init question container **/
SocketController.prototype.initQuestionContainer = function() {
    const self = this
    for (let i = 1; i<= config.questionCount; i++) {
        self.questionContainer.push(QuestionStatus.none)
    }
}

SocketController.prototype.init = function() {
    const self = this

    /** socket connection **/
    self.io.on('connection', socket => {
        /**
         *
         * Client socket handlers
         *
         * **/

        /** client init **/
        socket.on('clientInit', rect => {
            self.clientConnectionStatus = true
            socket.join(self.Rooms.client)
            self.initFrame = rect
            self.io.in(self.Rooms.users).emit('initFrame', rect)
            self.io.in(self.Rooms.users).emit('clientHasBeenConnected')
            console.log(`client has been connected, ${new Date()}`)

            /** remove socket **/
            socket.on('disconnect', () => {
                self.clientConnectionStatus = false
                self.controlAccess = false
                console.log('client has been disconnected')
                self.io.in(self.Rooms.users).emit('denyRemoteControl')
                self.io.in(self.Rooms.users).emit('clientHasBeenDisconnected')
                console.log(`client has been disconnected, ${new Date()}`)
            })
        })

        /** offer from client on webRTC connection **/
        socket.on('offerFromClient', offer => {
            console.log(`offer has been received, ${new Date()}`)
            self.currentUser.emit('offerFromClient', offer)
        })

        socket.on('answerFromUser', answer => {
            console.log(`answer has been received, ${new Date()}`)
            self.io.in(self.Rooms.client).emit('answerFromUser', answer)
        })

        /** new screenshot from client **/
        socket.on('screenshot', async data => {
            await serverUtils.saveScreen(data.filename, data.buffer, err => {
                if (err)
                    console.error(err)
                /** send new screenshot all users **/
                if (data.filename.startsWith('new'))
                    self.io.in(self.Rooms.users).emit('newScreenshot', `/${data.filename}`)
                else
                    self.io.in(self.Rooms.users).emit('answeredScreenshot', `/${data.filename}`)
                console.log(`new screenshot: ${data.filename}, ${new Date()}`)
            })
        })

        /** new raw frame from client **/
        socket.on('rawFrame', rect => {
            /** encode and send frame to all users **/
            if (self.currentUser)
                serverUtils.encodeAndSendFrame(self.currentUser, rect, serverUtils.sendFrame)
        })

        /** new copy frame from client**/
        socket.on('copyFrame', rect => {
            if (self.currentUser)
                self.currentUser.emit('copyFrame', rect)
        })

        /** remote control has been allowed **/
        socket.on('allowRemoteControl', () => {
            self.controlAccess = true
            self.io.in(self.Rooms.users).emit('allowRemoteControl')
            console.log(`allow remote control, ${new Date()}`)
        })

        /** remote control has been denied **/
        socket.on('denyRemoteControl', () => {
            self.controlAccess = false
            self.io.in(self.Rooms.users).emit('denyRemoteControl')
            console.log(`deny remote control, ${new Date()}`)
        })


        /**
         *
         * User socket handlers
         *
         * **/

        /** add user **/
        socket.on('user', async () => {
            socket.join(self.Rooms.users)
            console.log(`new user socket has been connected ${new Date()}`)
            /** send old screens **/
            const files = await serverUtils.readDirFiles(__dirname + '/../screens')
            files.splice(files.indexOf(/readme/gm), 1)
            socket.emit('oldScreens', files)
            /** send all question statuses **/
            for (let i = 0; i <= self.questionContainer.length; i++) {
                socket.emit('questionStatusFromServer', {
                    id: i + 1,
                    status: self.questionContainer[i],
                    isNeedPlaySound: false
                })
            }
            /** send init frame **/
            if (self.initFrame)
                socket.emit('initFrame', self.initFrame)
            self.io.in(self.Rooms.client).emit('requestUpdate')
            if (self.controlAccess && !self.currentUser)
                socket.emit('allowRemoteControl')
            /** send client connection status to new socket **/
            if (self.clientConnectionStatus)
                socket.emit('clientHasBeenConnected')
            else
                socket.emit('clientHasBeenDisconnected')

            /** remove socket **/
            socket.on('disconnect', () => {
                console.log(`user socket has been disconnected, ${new Date()}`)
                if (self.currentUser == socket) {
                    self.currentUser = null
                    self.io.in(self.Rooms.users).emit('stopRemoteControl')
                    self.io.in(self.Rooms.users).emit('allowRemoteControl')
                    console.log(`stop remote control, ${new Date()}`)
                }
            })
        })

        /** receive new question status from node **/
        socket.on('questionStatusFromNode', data => {
            self.questionContainer[data.id - 1] = data.status
            socket.broadcast.emit('questionStatusFromServer', data)
            console.log(`question ${data.id}, status: ${data.status}, ${new Date()}`)
        })

        /** mouse event from node **/
        socket.on('mouseEventFromNode', mouse => {
            self.io.in(self.Rooms.client).emit('mouse', mouse)
        })

        /** keyboard event **/
        socket.on('keyboardEventFromNode', keyboard => {
            self.io.in(self.Rooms.client).emit('keyboard', {
                isDown: keyboard.isDown,
                keyCode: serverUtils.toRfbKeyCode(keyboard.code, keyboard.shift)
            })
        })

        /** remote control **/
        socket.on('startRemoteControl', () => {
            self.currentUser = socket
            socket.broadcast.emit('startRemoteControl')
            console.log(`start remote control, ${new Date()}`)
        })

        /** stop remote control **/
        socket.on('stopRemoteControl', () => {
            self.currentUser = null
            socket.broadcast.emit('stopRemoteControl')
            self.io.in(self.Rooms.users).emit('allowRemoteControl')
            console.log(`stop remote control, ${new Date()}`)
        })

        /** remove screens (new or answered) **/
        socket.on('removeScreens', async isNew => {
            await serverUtils.removeScreens(isNew, self.io, self.Rooms)
        })

        /** reset question statuses **/
        socket.on('resetQuestions', () => {
            for (let i = 0; i < self.questionContainer.length; i++) {
                self.questionContainer[i] = QuestionStatus.none
                self.io.in(self.Rooms.users).emit('questionStatusFromServer', {
                    id: i + 1,
                    status: self.questionContainer[i],
                    isNeedPlaySound: false
                })
            }
            console.log(`reset questions, ${new Date()}`)
        })

        /** update screen handler **/
        socket.on('requestUpdate', () => {
            self.io.in(self.Rooms.client).emit('requestUpdate')
        })
    })
}

module.exports = SocketController
