'use strict'

/** global counters for notifications **/
let newCounter = 0
let answeredCounter = 0

/** control access **/
let controlAccess = false
let remoteAccess = false
let isControlNow = false

/** global peer storage **/
let peer = null
let isPeerConnected = false

/** gallery options **/
const galleryOptions_new = {
    loop: false,
    thumbnail: true,
    showThumbByDefault: false,
    share: false,
    autoplay: false,
    autoplayControls: false,
    subHtmlSelectorRelative: true,
    html: true,
    galleryId: 1
}

const galleryOptions_old = {
    loop: false,
    thumbnail: true,
    showThumbByDefault: false,
    share: false,
    autoplay: false,
    autoplayControls: false,
    subHtmlSelectorRelative: true,
    html: true,
    galleryId: 2
}

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

/** Notification statuses for sweetalert2 **/
const NotificationStatus = {
    warning: 'warning',
    error: 'error',
    success: 'success',
    info: 'info',
    question: 'question'
}
/** freeze enum **/
Object.freeze(NotificationStatus)

/** draw frame from webRTC data **/
function drawFrameFromPeer(rect, screen) {
    return new Promise((resolve, reject) => {
        try {
            rect = JSON.parse(rect.toString('utf8'))
            screen.drawFrame({
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    image: {
                        encoding: 'raw',
                        data: rect.data.data
                    }
                }
            )
            resolve()
        }
        catch (e) {
            console.error(e)
            reject(e)
        }
    })
}

/** add handler to edit buttons **/
function addEditHandlers(socket) {
    $('#deleteNew').click(() => {
        const success = () => {
            socket.emit('removeScreens', true)
        }
        confirmDialog('Удалить все новые скрины?', success)
    })

    $('#deleteAnswered').click(() => {
        const success = () => {
            socket.emit('removeScreens', false)
        }
        confirmDialog('Удалить все отвеченные скрины?', success)
    })
    /** reset questions **/
    $('#resetQuestions').click(() => {
        const success = () => {
            socket.emit('resetQuestions')
        }
        confirmDialog('Сбросить вопросы?', success)
    })
}

/** create confirm dialog **/
function confirmDialog(text, ok, cancel) {
    Swal.fire({
        title: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Да',
        cancelButtonText: 'Отмена'
    }).then((result) => {
        if (result.value)
            ok()
        else if (cancel)
            cancel()
    })
}
/** add screen handlers to screen **/
function addScreenHandlers(screen, socket) {
    /** screen mouse handler **/
    screen.on('mouseEvent', (x, y, button) => {
        if (isPeerConnected) {
            peer.send(jsonToBuffer({
                event: 'mouse',
                x: x,
                y: y,
                button: button
            }))
        }
        else {
            socket.emit('mouseEventFromNode', {
                x: x,
                y: y,
                button: button
            })
        }
    })

    /** screen keyboard handler **/
    screen.on('keyEvent', (code, shift, isDown) => {
        if (isPeerConnected) {
            peer.send(jsonToBuffer({
                event: 'keyboard',
                code: code,
                shift: shift,
                isDown: isDown
            }))
        }
        else {
            socket.emit('keyboardEventFromNode', {
                code: code,
                shift: shift,
                isDown: isDown
            })
        }
    })
}

/** control button handler **/
function controlBtnHandler(socket, controller, refreshScreenBtn, rtcStatus, rtcStatusIcon) {
    controlAccess = true
    controller.off('click')
    refreshScreenBtn.off('click')
    controller.removeClass('scale-out')
    controller.addClass('scale-in')
    $('#control-icon').html('settings_remote')
    /** start **/
    controller.click(() => {
        refreshScreenBtn.removeClass('scale-out')
        refreshScreenBtn.addClass('scale-in')
        $('#page-content').css('display', 'none')
        $('#screen').css('display', 'block')
        socket.emit('startRemoteControl')
        controller.addClass('red accent-4')
        $('#control-icon').html('stop')
        controller.off('click')
        playSound('on.mp3')
        isControlNow = true

        /** refresh screen before control **/
        socket.emit('requestUpdate')

        /** refresh remote screen **/
        refreshScreenBtn.click(() => {
            socket.emit('requestUpdate')
        })

        scaleRtcStatusIn(rtcStatus)

        /** stop **/
        controller.click(() => {
            isControlNow = false
            $('#page-content').css('display', 'block')
            $('#screen').css('display', 'none')
            socket.emit('stopRemoteControl')
            controller.removeClass('red accent-4')
            $('#control-icon').html('settings_remote')
            controller.off('click')
            refreshScreenBtn.removeClass('scale-in')
            refreshScreenBtn.addClass('scale-out')
            refreshScreenBtn.off('click')
            playSound('off.mp3')
            scaleRtcStatusOut(rtcStatus, rtcStatusIcon)
            /** recursive call **/
            controlBtnHandler(socket, controller, refreshScreenBtn, rtcStatus, rtcStatusIcon)
        })
    })
}

/** scroll block down **/
function scrollDown(id) {
    $(`#${id}`).animate({
        scrollTop: $(`#${id}`).prop("scrollHeight")
    }, 800)
}

/** broadcasting question status to all users **/
function broadCastQuestionStatus(socket, questionId, questionStatus) {
    socket.emit('questionStatusFromNode', {
        id: questionId,
        status: questionStatus,
        isNeedPlaySound: true
    })
}

/** create question table **/
async function createQuestionTable(count, socket) {
    for (let i = 1; i <= count; i++) {
        await createCheckButton(i)
        $(`#question_${i}`).click(() => {
            if ($(`#question_${i}`).hasClass('grey darken-1')) {
                $(`#question_${i}`).toggleClass('grey darken-1')
                $(`#question_${i}`).toggleClass('cyan lighten-3')
                broadCastQuestionStatus(socket, i, QuestionStatus.received)
            }
            else if ($(`#question_${i}`).hasClass('cyan lighten-3')) {
                $(`#question_${i}`).toggleClass('cyan lighten-3')
                $(`#question_${i}`).toggleClass('yellow accent-4')
                broadCastQuestionStatus(socket, i, QuestionStatus.resolving)
            }
            else if ($(`#question_${i}`).hasClass('yellow accent-4')) {
                $(`#question_${i}`).toggleClass('yellow accent-4')
                $(`#question_${i}`).toggleClass('red darken-1')
                broadCastQuestionStatus(socket, i, QuestionStatus.suspended)
            }
            else if ($(`#question_${i}`).hasClass('red darken-1')) {
                $(`#question_${i}`).toggleClass('red darken-1')
                $(`#question_${i}`).toggleClass('green accent-4')
                broadCastQuestionStatus(socket, i, QuestionStatus.done)
            }
            else if ($(`#question_${i}`).hasClass('green accent-4')) {
                $(`#question_${i}`).toggleClass('green accent-4')
                $(`#question_${i}`).toggleClass('grey darken-1')
                broadCastQuestionStatus(socket, i, QuestionStatus.none)
            }
        })
    }
}

/** create checkButton **/
function createCheckButton(number) {
    return new Promise((resolve, reject) => {
        let content = number.toString()
        if (number < 10)
            content += '&nbsp '
        const button = `
        <a class="waves-effect waves-light btn question_btn grey darken-1" id="question_${number}">${content}</a>
        `
        $('#question_card').append(button)
        resolve(number)
    })
}

/** play sound **/
function playSound(url) {
    new Audio(`/${url}`).play();
}

/** fire notification **/
function fireNotification(text, notificationStatus) {
    Swal.fire({
        title: text,
        type: notificationStatus,
        toast: true,
        position: 'top-end',
        timer: 4000,
        showConfirmButton: false,
        background: '#cbf7f4'
    })
    playSound('notification.wav')
}

/** add answered screen **/
function addOldScreen(name, galleryOld) {
    const slide =
        `  <a href="${name}">
          <div class="caption hoverable z-depth-1 center-align">
            <img src="${name}" />
            <p>${name.slice(1, name.length - 4)}</p>
          </div>
      </a>`
    galleryOld.append(slide)
    galleryOld.data('lightGallery').destroy(true)
    galleryOld.lightGallery(galleryOptions_old)
}

/** add new screen to new screens **/
function addNewScreen(name, galleryNew) {
    const slide =
        `  <a href="${name}">
          <div class="caption hoverable z-depth-1 center-align">
            <img src="${name}" />
            <p>${name.slice(1, name.length - 4)}</p>
          </div>
      </a>`
    galleryNew.append(slide)
    galleryNew.data('lightGallery').destroy(true)
    galleryNew.lightGallery(galleryOptions_new)
}

/**
 * Socket event handlers
 *
 * **/

function onClientDisconnect(clientStatus, clientStatusIcon) {
    clientStatus.removeClass('light-green')
    clientStatus.addClass('red')
    clientStatusIcon.html('report_problem')
}

function onClientConnect(clientStatus, clientStatusIcon) {
    clientStatus.removeClass('red')
    clientStatus.addClass('light-green')
    clientStatusIcon.html('settings_input_antenna')
}

function reloadGallery(gallery, options) {
    gallery.html('')
    gallery.data('lightGallery').destroy(true)
    gallery.lightGallery(options)
}

function onStartRemoteControl(remoteController, refreshScreenBtn) {
    controlAccess = false
    remoteController.addClass('scale-out')
    remoteController.removeClass('scale-in')
    refreshScreenBtn.addClass('scale-out')
    refreshScreenBtn.removeClass('scale-in')
    fireNotification('Удаленное управление пользователем', NotificationStatus.info)
    destroyPeer()
}

function onDenyRemoteControl(remoteController, refreshScreenBtn, rtcStatus, rtcStatusIcon) {
    if (remoteAccess) {
        remoteAccess = false
        controlAccess = false
        $('#page-content').css('display', 'block')
        $('#screen').css('display', 'none')
        remoteController.addClass('scale-out')
        remoteController.removeClass('scale-in')
        refreshScreenBtn.addClass('scale-out')
        refreshScreenBtn.removeClass('scale-in')
        remoteController.removeClass('red accent-4')
        remoteController.off('click')
        refreshScreenBtn.off('click')
    }
    scaleRtcStatusOut(rtcStatus, rtcStatusIcon)
    destroyPeer()
}

function onAllowRemoteControl(socket, remoteController, refreshScreenBtn, rtcStatus, rtcStatusIcon) {
    if (!remoteAccess) {
        controlAccess = true
        remoteAccess = true
        controlBtnHandler(socket, remoteController, refreshScreenBtn, rtcStatus, rtcStatusIcon)
        fireNotification('Рарешен удаленный доступ', NotificationStatus.warning)
    }
}

function onQuestionChange(data) {
    $(`#question_${data.id}`).removeClass('grey darken-1 cyan lighten-3 yellow accent-4 red darken-1 green accent-4')
    let newStyleClass = ''
    if (data.status == QuestionStatus.none) {
        if (data.isNeedPlaySound)
            fireNotification(`Вопрос ${data.id} отсутствует`, NotificationStatus.error)
        newStyleClass = 'grey darken-1'
    }
    else if (data.status == QuestionStatus.received) {
        newStyleClass = 'cyan lighten-3'
        if (data.isNeedPlaySound)
            fireNotification(`Вопрос ${data.id} получен`, NotificationStatus.info)
    }
    else if (data.status == QuestionStatus.resolving) {
        newStyleClass = 'yellow accent-4'
        if (data.isNeedPlaySound)
            fireNotification(`Вопрос ${data.id} решается`, NotificationStatus.warning)
    }
    else if (data.status == QuestionStatus.suspended) {
        newStyleClass = 'red darken-1'
        if (data.isNeedPlaySound)
            fireNotification(`Вопрос ${data.id} отложен`, NotificationStatus.error)
    }
    else if (data.status == QuestionStatus.done) {
        newStyleClass = 'green accent-4'
        if (data.isNeedPlaySound)
            fireNotification(`Вопрос ${data.id} решен`, NotificationStatus.success)
    }
    $(`#question_${data.id}`).addClass(newStyleClass)
}

function updateScreenCounter(counter, value) {
    counter.html(value)
    counter.removeClass('scale-out')
    counter.addClass('scale-in')
}

function onSocketDisconnect(userStatus, userStatusIcon, clientStatus, clientStatusIcon) {
    userStatus.removeClass('light-green')
    userStatus.addClass('red')
    userStatusIcon.html('report_problem')
    onClientDisconnect(clientStatus, clientStatusIcon)
}

function onSocketConnect(userStatus, userStatusIcon) {
    userStatus.removeClass('red')
    userStatus.addClass('light-green')
    userStatusIcon.html('settings_input_antenna')
}

async function initPage(
    galleryNew,
    galleryOld,
    newCounterIcon,
    answeredCounterIcon,
    socket
) {

    /** gallery init **/
    galleryNew.lightGallery(galleryOptions_new)
    galleryOld.lightGallery(galleryOptions_old)

    galleryNew.on('onBeforeOpen.lg', () => {
        newCounterIcon.removeClass('scale-in')
        newCounterIcon.addClass('scale-out')
        newCounter = 0
    })
    galleryOld.on('onBeforeOpen.lg', () => {
        answeredCounterIcon.removeClass('scale-in')
        answeredCounterIcon.addClass('scale-out')
        answeredCounter = 0
    })

    /** creating the question table **/
    await createQuestionTable(150, socket)
    /** tooltip init **/
    $('.tooltipped').tooltip()
    /** action button init **/
    $('.fixed-action-btn').floatingActionButton({
        direction: 'bottom',
        hoverEnabled: false
    })
    /** add edit button handlers **/
    addEditHandlers(socket)
}

/**
 * Peer connection
 *
 * **/

function peerInit(socket, screen, offer, rtcStatus, rtcStatusIcon) {
    /** destroy old connection **/
    destroyPeer()

    scaleRtcStatusIn(rtcStatus)
    /** create nw connection **/
    peer = new Peer({
        trickle: false,
        initiator: false
    })
    peer.signal(offer)

    /** webRTC handlers **/
    peer.on('signal', answer => {
        socket.emit('answerFromUser', answer)
        console.log(`answer has been sent to client, ${new Date()}`)
    })
    /** data from user **/
    peer.on('data', data => {
        drawFrameFromPeer(data.toString('utf8'), screen)
    })

    peer.on('connect', () => {
        successRtcStatus(rtcStatus, rtcStatusIcon)
        isPeerConnected = true
        console.log(`webRTC connection, ${new Date()}`)
    })
    /** error handler **/
    peer.on('error', error => {
        errorRtcStatus(rtcStatus, rtcStatusIcon)
        destroyPeer()
        peerRequest(socket)
        console.error(`webRTC error, ${new Date()}`)
        console.error(error)
    })
    /** peer has been disconnected **/
    peer.on('disconnect', () => {
        errorRtcStatus(rtcStatus, rtcStatusIcon)
        destroyPeer()
        peerRequest(socket)
        console.log(`peer has been disconnected, ${new Date()}`)
    })
}

/** destroy peer connection **/
function destroyPeer() {
    if (peer) {
        isPeerConnected = false
        peer.destroy()
        peer = null
        console.log(`destroy peer, ${new Date()}`)
    }
}

/** new peer request after previous webRTC connection has been closed **/
function peerRequest(socket) {
    if (remoteAccess && controlAccess && isControlNow) {
        socket.emit('peerRequest')
        console.log(`peer request, ${new Date()}`)
    }
}

function jsonToBuffer(json) {
    return Buffer.Buffer.from(JSON.stringify(json), 'utf8')
}

function successRtcStatus(rtcStatus, rtcStatusIcon) {
    rtcStatus.removeClass('red')
    rtcStatus.addClass('light-green')
    rtcStatusIcon.html('settings_input_antenna')
}

function errorRtcStatus(rtcStatus, rtcStatusIcon) {
    rtcStatus.removeClass('light-green')
    rtcStatus.addClass('red')
    rtcStatusIcon.html('report_problem')
}

function scaleRtcStatusIn(rtcStatus) {
    rtcStatus.removeClass('scale-out')
    rtcStatus.addClass('scale-in')
}

function scaleRtcStatusOut(rtcStatus, rtcStatusIcon) {
    errorRtcStatus(rtcStatus, rtcStatusIcon)
    rtcStatus.removeClass('scale-in')
    rtcStatus.addClass('scale-out')
}