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
    this.users = []
    this.tokens = new Set()
    this.teams = new Map()
    this.authTokens = {}
    /** init controller **/
    this.init()
}

/** save users **/
SocketController.prototype.saveUsers = async function() {
    const self = this
    await serverUtils.saveUsers(self.users)
}

/** get next user id **/
SocketController.prototype.getNextUserId = function() {
    const self = this
    if (self.users.length === 0)
        return 1
    else {
        return self.users[self.users.length - 1].id + 1
    }
}

/** update team and token containers for new/updated user **/
SocketController.prototype.updateToken = function(token, socket) {
    const self = this
    /** if token does not exist in token Set **/
    if (!self.tokens.has(token)) {
        /** update token Set **/
        self.tokens.add(token)
        /** update team Map **/
        self.teams.set(token, {
            clientConnectionStatus: false,
            initFrame: null,
            controlAccess: false,
            currentUser: null,
            questionContainer: [],
            rooms: {
                client: token + '-c',
                user: token + '-u'
            }
        })
        /** create question container for token **/
        for (let i = 1; i<= config.questionCount; i++) {
            self.teams.get(token).questionContainer.push(QuestionStatus.none)
        }
        /** init folder for new token **/
        serverUtils.initDirForToken(token)
        /** send new token to admin **/
        socket.emit('newToken', token)
    }
}

/** init socket controller **/
SocketController.prototype.init = async function() {
    const self = this

    /** load users **/
    self.users = (await serverUtils.loadUsers()).users

    /** init tokens **/
    self.users.map(user => {
        self.tokens.add(user.token)
    })

    /** init team Map and screen folder for each token **/
    self.tokens.forEach(token => {
        /** init team Map **/
        self.teams.set(token, {
            clientConnectionStatus: false,
            initFrame: null,
            controlAccess: false,
            currentUser: null,
            questionContainer: [],
            rooms: {
                client: token + '-c',
                user: token + '-u'
            }
        })
        /** init screen folder **/
        serverUtils.initDirForToken(token)
    })

    /** init question containers **/
    self.teams.forEach(((value, key) => {
        for (let i = 1; i<= config.questionCount; i++) {
            value.questionContainer.push(QuestionStatus.none)
        }
    }))

    /** socket connection **/
    self.io.on('connection', socket => {
        /**
         *
         * Client socket handlers
         *
         * **/

        /** client init **/
        socket.on('clientInit', (rect, token) => {
            const teamConfig = self.teams.get(token)
            /** if token exists **/
            if (teamConfig) {
                teamConfig.clientConnectionStatus = true
                socket.join(teamConfig.rooms.client)
                teamConfig.initFrame = rect
                self.io.in(teamConfig.rooms.user).emit('initFrame', teamConfig.initFrame)
                self.io.in(teamConfig.rooms.user).emit('clientHasBeenConnected')
                console.log(`client has been connected, token: ${token}, ${new Date()}`)

                /** remove socket **/
                socket.on('disconnect', () => {
                    teamConfig.clientConnectionStatus = false
                    self.io.in(teamConfig.rooms.user).emit('denyRemoteControl')
                    self.io.in(teamConfig.rooms.user).emit('clientHasBeenDisconnected')
                    console.log(`client has been disconnected, token: ${token}, ${new Date()}`)
                })
            }
            else {
                /** if client token does not exist **/
                socket.disconnect()
                console.log(`client has been rejected, token: ${token} not found, ${new Date()}`)
            }
        })

        /** offer from client on webRTC connection **/
        socket.on('offerFromClient', (offer, token) => {
            console.log(`offer has been received, token: ${token}, ${new Date()}`)
            const teamConfig = self.teams.get(token)
            if (teamConfig.currentUser)
                teamConfig.currentUser.emit('offerFromClient', offer)
        })

        socket.on('answerFromUser', (answer, token) => {
            const teamConfig = self.teams.get(token)
            console.log(`answer has been received, token: ${token}, ${new Date()}`)
            self.io.in(teamConfig.rooms.client).emit('answerFromUser', answer)
        })

        /** new screenshot from client **/
        socket.on('screenshot', async (data, token) => {
            const teamConfig = self.teams.get(token)
            await serverUtils.saveScreen(token, data.filename, data.buffer, err => {
                if (err)
                    console.error(err)
                /** send new screenshot all users **/
                if (data.filename.startsWith('new'))
                    self.io.in(teamConfig.rooms.user).emit('newScreenshot', `/${data.filename}`)
                else
                    self.io.in(teamConfig.rooms.user).emit('answeredScreenshot', `/${data.filename}`)
                console.log(`new screenshot: ${data.filename}, token: ${token}, ${new Date()}`)
            })
        })

        /** new raw frame from client **/
        socket.on('rawFrame', (rect, token) => {
            const teamConfig = self.teams.get(token)
            /** encode and send frame to all users **/
            if (teamConfig.currentUser)
                serverUtils.encodeAndSendFrame(teamConfig.currentUser, rect, serverUtils.sendFrame)
        })

        /** new copy frame from client**/
        socket.on('copyFrame', (rect, token) => {
            const teamConfig = self.teams.get(token)
            if (teamConfig.currentUser)
                teamConfig.currentUser.emit('copyFrame', rect)
        })

        /** remote control has been allowed **/
        socket.on('allowRemoteControl', token => {
            const teamConfig = self.teams.get(token)
            teamConfig.controlAccess = true
            self.io.in(teamConfig.rooms.user).emit('allowRemoteControl')
            console.log(`allow remote control, token: ${token}, ${new Date()}`)
        })

        /** remote control has been denied **/
        socket.on('denyRemoteControl', token => {
            const teamConfig = self.teams.get(token)
            teamConfig.controlAccess = false
            self.io.in(teamConfig.rooms.user).emit('denyRemoteControl')
            console.log(`deny remote control, token: ${token} ${new Date()}`)
        })


        /**
         *
         * User socket handlers
         *
         * **/

        /** add user **/
        socket.on('user', async cookies => {
            cookies = cookies.substring(10)
            const user = self.authTokens[cookies]
            const token = user.token
            socket.emit('token', token)
            const teamConfig = self.teams.get(token)
            if (teamConfig) {
                socket.join(teamConfig.rooms.user)
                console.log(`new user socket has been connected, token: ${token} ${new Date()}`)
                /** send old screens **/
                const files = await serverUtils.readDirFiles(__dirname + `/../screens/${token}`)
                socket.emit('oldScreens', files)
                /** send all question statuses **/
                for (let i = 0; i <= teamConfig.questionContainer.length; i++) {
                    socket.emit('questionStatusFromServer', {
                        id: i + 1,
                        status: teamConfig.questionContainer[i],
                        isNeedPlaySound: false
                    })
                }
                /** send init frame **/
                if (teamConfig.initFrame)
                    socket.emit('initFrame', teamConfig.initFrame)
                if (teamConfig.controlAccess && !teamConfig.currentUser && teamConfig.clientConnectionStatus)
                    socket.emit('allowRemoteControl')
                /** send client connection status to new socket **/
                if (teamConfig.clientConnectionStatus)
                    socket.emit('clientHasBeenConnected')
                else
                    socket.emit('clientHasBeenDisconnected')
                /** admin access **/
                if (user.adminAccess)
                    socket.emit('adminAccess')

                /** exit user **/
                socket.on('exit', () => {
                    delete self.authTokens[cookies]
                })

                /** remove socket **/
                socket.on('disconnect', () => {
                    console.log(`user socket has been disconnected, token: ${token}, ${new Date()}`)
                    if (self.currentUser === socket) {
                        teamConfig.currentUser = null
                        self.io.in(teamConfig.rooms.user).emit('stopRemoteControl')
                        self.io.in(teamConfig.rooms.user).emit('allowRemoteControl')
                        console.log(`stop remote control, token: ${token}, ${new Date()}`)
                    }
                })
            }
            else {
                socket.disconnect()
                console.log(`user has been rejected, token: ${token} not found, ${new Date()}`)
            }
        })

        /** receive new question status from node **/
        socket.on('questionStatusFromNode', (data, token) => {
            const teamConfig = self.teams.get(token)
            teamConfig.questionContainer[data.id - 1] = data.status
            socket.to(teamConfig.rooms.user).emit('questionStatusFromServer', data)
            console.log(`question ${data.id}, status: ${data.status}, token: ${token}, ${new Date()}`)
        })

        /** mouse event from node **/
        socket.on('mouseEventFromNode', (mouse, token) => {
            const teamConfig = self.teams.get(token)
            self.io.in(teamConfig.rooms.client).emit('mouse', mouse)
        })

        /** keyboard event **/
        socket.on('keyboardEventFromNode', (keyboard, token) => {
            const teamConfig = self.teams.get(token)
            self.io.in(teamConfig.rooms.client).emit('keyboard', {
                isDown: keyboard.isDown,
                keyCode: serverUtils.toRfbKeyCode(keyboard.code, keyboard.shift)
            })
        })

        /** remote control **/
        socket.on('startRemoteControl', token => {
            const teamConfig = self.teams.get(token)
            teamConfig.currentUser = socket
            socket.to(teamConfig.rooms.user).emit('startRemoteControl')
            self.io.in(teamConfig.rooms.client).emit('startRemoteControl')
            console.log(`start remote control, token: ${token}, ${new Date()}`)
        })

        /** stop remote control **/
        socket.on('stopRemoteControl', token => {
            const teamConfig = self.teams.get(token)
            teamConfig.currentUser = null
            self.io.in(teamConfig.rooms.user).emit('stopRemoteControl')
            self.io.in(teamConfig.rooms.user).emit('allowRemoteControl')
            console.log(`stop remote control, token: ${token}, ${new Date()}`)
        })

        /** new webRTC connection request **/
        socket.on('peerRequest', token => {
            const teamConfig = self.teams.get(token)
            if (teamConfig.controlAccess)
                self.io.in(teamConfig.rooms.client).emit('peerRequest')
        })

        /** update screen handler **/
        socket.on('requestUpdate', token => {
            const teamConfig = self.teams.get(token)
            self.io.in(teamConfig.rooms.client).emit('requestUpdate')
        })

        /**
         *
         * Admin socket handlers
         *
         * **/
        /** remove screens (new or answered) **/

        /** init admin **/
        socket.on('admin', cookies => {
            cookies = cookies.substring(10)
            self.users.forEach(user => {
                socket.emit('userForAdmin', user)
            })

            /** exit admin **/
            socket.on('exit', () => {
                delete self.authTokens[cookies]
            })

            /** request for screens **/
            socket.on('requestScreenForToken', async token => {
                const files = await serverUtils.readDirFiles(__dirname + `/../screens/${token}`)
                socket.emit('screensForToken', files, token)
            })

            /** delete new handler **/
            socket.on('deleteNewForToken', token => {
                const teamConfig = self.teams.get(token)
                if (teamConfig)
                    serverUtils.removeScreens(true, teamConfig.rooms.user, token, socket)
            })

            /** delete old handler **/
            socket.on('deleteOldForToken', token => {
                const teamConfig = self.teams.get(token)
                if (teamConfig)
                    serverUtils.removeScreens(false, teamConfig.rooms.user, token, socket)
            })

            /** send all tokens **/
            self.tokens.forEach(token => {
                socket.emit('newToken', token)
            })
        })

        /** add/edit user **/
        socket.on('addUser', async user => {
            /** user already exists **/
            if (user.id) {
                const userForEdit = self.users.find(baseUser => baseUser.id === user.id)
                userForEdit.firstName = user.firstName
                userForEdit.lastName = user.lastName
                userForEdit.login = user.login
                userForEdit.password = user.password
                userForEdit.beginDate = user.beginDate
                userForEdit.endDate = user.endDate
                userForEdit.token = user.token
                userForEdit.userAccess = user.userAccess
                userForEdit.adminAccess = user.adminAccess
                await self.saveUsers()
                console.log(`edit user, user id: ${user.id}`)
                socket.emit('editUser', user)
            }
            /** user does not exist. Create new user **/
            else {
                user.id = self.getNextUserId()
                self.users.push(user)
                await self.saveUsers()
                console.log(`add user: ${user.login}, ${new Date()}`)
                socket.emit('addUser', user)
            }
            /** update token **/
            self.updateToken(user.token, socket)
        })

        /** delete user **/
        socket.on('deleteUser', async userId => {
            const userForDelete = self.users.find(user => user.id === userId)
            if (userForDelete) {
                const indexForDelete = self.users.indexOf(userForDelete)
                self.users.splice(indexForDelete, 1)
                await self.saveUsers()
                console.log(`delete user ${userForDelete.firstName} ${userForDelete.lastName}, ${new Date()}`)
                socket.emit('deleteUser', userId)
            }
        })
    })
}

module.exports = SocketController
