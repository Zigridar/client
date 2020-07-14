'use strict'

/** page init **/
$(document).ready(async () => {

    /** jQuery objects init **/
    const galleryNew = $("#lightgallery_new")
    const galleryOld = $("#lightgallery_old")
    const newCounterIcon = $('#new_counter')
    const answeredCounterIcon = $('#answered_counter')
    const remoteController = $('#remote-controller')
    const refreshScreenBtn = $('#update-remote-screen')
    const clientStatus = $('#client-status')
    const clientStatusIcon = $('#client-status-icon')
    const userStatus = $('#user-status')
    const userStatusIcon = $('#user-status-icon')
    const rtcStatus = $('#rtc-status')
    const rtcStatusIcon = $('#rtc-status-icon')
    const exitBtn = $('#exit-btn')
    const questionContainer = $('#question_card')

    /** screen init **/
    const screen = new Screen(document.getElementById('screen'))

    /** socket init **/
    const socket = await io.connect({
        forceNew: true,
        transports: ['websocket'],
        allowUpgrades: false,
        pingTimeout: 30000
    })

    /** init server user **/
    socket.on('connect', () => {
        onSocketConnect(userStatus, userStatusIcon)
        /** init server user **/
        socket.emit('user', document.cookie)
    })

    /** await token from user **/
    socket.once('token', async token => {
        /** init page **/
        await initPage(
            galleryNew,
            galleryOld,
            newCounterIcon,
            answeredCounterIcon,
            exitBtn,
            questionContainer,
            socket,
            token
        )

        /** disconnect socket from server **/
        socket.on('disconnect', () => {
            onSocketDisconnect(userStatus, userStatusIcon, clientStatus, clientStatusIcon)
        })

        /** admin access **/
        socket.on('adminAccess', () => {
            $('#admin-btn').css('display', 'block')
        })

        /** add all old screens to page **/
        socket.on('oldScreens', files => {
            files.forEach(item => {
                if (item.startsWith('new')){
                    addNewScreen(`/${item}`, token, galleryNew)
                }
                else {
                    addOldScreen(`/${item}`, token, galleryOld)
                }
            })
        })

        /** add new screen to page **/
        socket.on('newScreenshot', filename => {
            addNewScreen(filename, token, galleryNew)
            fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
            updateScreenCounter(newCounterIcon, ++newCounter)
        })

        /** add answered screen to page **/
        socket.on('answeredScreenshot', filename => {
            addOldScreen(filename, token, galleryOld)
            fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
            updateScreenCounter(answeredCounterIcon, ++answeredCounter)
        })

        /** receive new question status from server **/
        socket.on('questionStatusFromServer', data => {
            onQuestionChange(data)
        })

        /** init frame (once!!!) **/
        socket.once('initFrame', rect => {
            screen.init(rect.width, rect.height)
            addScreenHandlers(screen, socket)
        })

        /** draw new raw frame (using socket-server) **/
        socket.on('frame', data => {
            screen.drawFrame(data)
        })

        /** draw part of frame **/
        socket.on('copyFrame', data => {
            screen.copyFrame(data)
        })

        /** allow remote control **/
        socket.on('allowRemoteControl', () => {
            onAllowRemoteControl(socket, remoteController, refreshScreenBtn, rtcStatus, rtcStatusIcon)
        })

        /** deny remote control **/
        socket.on('denyRemoteControl', () => {
            onDenyRemoteControl(remoteController, refreshScreenBtn, rtcStatus, rtcStatusIcon)
        })

        /** other user has started remote control **/
        socket.on('startRemoteControl', () => {
            onStartRemoteControl(remoteController, refreshScreenBtn)
        })

        /** other user has stoped remote control **/
        socket.on('stopRemoteControl', () => {
            controlAccess = true
            if (remoteAccess) {
                controlBtnHandler(socket, remoteController, refreshScreenBtn, rtcStatus, rtcStatusIcon)
            }
        })

        /** new screens has been deleted **/
        socket.on('newScreensIsDeleted', () => {
            reloadGallery(galleryNew, galleryOptions_new)
        })

        /** answered screens has been deleted **/
        socket.on('answeredScreensIsDeleted', () => {
            reloadGallery(galleryOld, galleryOptions_old)
        })

        /** connect has been connected to server **/
        socket.on('clientHasBeenConnected', () => {
            onClientConnect(clientStatus, clientStatusIcon)
        })

        /** client has been disconnected from server **/
        socket.on('clientHasBeenDisconnected', () => {
            onClientDisconnect(clientStatus, clientStatusIcon)
        })

        /** webRTC offer **/
        socket.on('offerFromClient', offer => {
            peerInit(socket, screen, offer, rtcStatus, rtcStatusIcon)
            console.log(`offer from server, ${new Date()}`)
        })
    })

})