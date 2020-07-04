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

    /** screen init **/
    const screen = new Screen(document.getElementById('screen'))

    /** socket init **/
    const socket = await io.connect({
        forceNew: true,
        transports: ['websocket'],
        allowUpgrades: false,
        pingTimeout: 30000
    })

    /** init page **/
    await initPage(
        galleryNew,
        galleryOld,
        newCounterIcon,
        answeredCounterIcon,
        socket
    )

    /** init server user **/
    socket.on('connect', () => {
        socket.emit('user')
        onSocketConnect(userStatus, userStatusIcon)
    })

    /** disconnect socket from server **/
    socket.on('disconnect', () => {
        onSocketDisconnect(userStatus, userStatusIcon, clientStatus, clientStatusIcon)
    })

    /** add all old screens to page **/
    socket.on('oldScreens', files => {
        files.forEach(item => {
            if (item.startsWith('new')){
                addNewScreen(`/${item}`, galleryNew)
            }
            else {
                addOldScreen(`/${item}`, galleryOld)
            }
        })
    })

    /** add new screen to page **/
    socket.on('newScreenshot', filename => {
        addNewScreen(filename, galleryNew)
        fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
        updateScreenCounter(newCounterIcon, ++newCounter)
    })

    /** add answered screen to page **/
    socket.on('answeredScreenshot', filename => {
        addOldScreen(filename, galleryOld)
        fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
        updateScreenCounter(answeredCounterIcon, ++answeredCounter)
    })

    /** receive new question status from server **/
    socket.on('questionStatusFromServer', data => {
        onQuestionChange(data)
    })

    /** init frame **/
    socket.on('initFrame', rect => {
        screen.removeHandlers()
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
        onAllowRemoteControl(socket, remoteController, refreshScreenBtn)
    })

    /** deny remote control **/
    socket.on('denyRemoteControl', () => {
        onDenyRemoteControl(remoteController, refreshScreenBtn)
    })

    /** other user has started remote control **/
    socket.on('startRemoteControl', () => {
        onStartRemoteControl(remoteController, refreshScreenBtn)
    })

    /** other user has stoped remote control **/
    socket.on('stopRemoteControl', () => {
        controlAccess = true
        if (remoteAccess) {
            controlBtnHandler(socket, remoteController, refreshScreenBtn)
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
})