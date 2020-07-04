'use strict'

/** global counters for notifications **/
let newCounter = 0
let answeredCounter = 0

/** control access **/
let controlAccess = false
let remoteAccess = false

/** container for buffered frame **/
let bufferedFrame = []

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
        rect = JSON.parse(rect)
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
        socket.emit('mouseEventFromNode', {
            x: x,
            y: y,
            button: button
        })
    })

    /** screen keyboard handler **/
    screen.on('keyEvent', (code, shift, isDown) => {
        socket.emit('keyboardEventFromNode', {
            code: code,
            shift: shift,
            isDown: isDown
        })
    })
}

/** control button handler **/
function controlBtnHandler(socket, controller) {
    controlAccess = true
    controller.off('click')
    controller.removeClass('scale-out')
    controller.addClass('scale-in')
    $('#control-icon').html('settings_remote')
    /** start **/
    controller.click(() => {
        $('#page-content').css('display', 'none')
        $('#screen').css('display', 'block')
        socket.emit('startRemoteControl')
        controller.addClass('red accent-4')
        $('#control-icon').html('stop')
        controller.off('click')
        playSound('on.mp3')
        /** stop **/
        controller.click(() => {
            $('#page-content').css('display', 'block')
            $('#screen').css('display', 'none')
            socket.emit('stopRemoteControl')
            controller.removeClass('red accent-4')
            $('#control-icon').html('settings_remote')
            controller.off('click')
            playSound('off.mp3')
            /** recursive call **/
            controlBtnHandler(socket, controller)
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

function onStartRemoteControl(remoteController) {
    controlAccess = false
    remoteController.addClass('scale-out')
    remoteController.removeClass('scale-in')
    fireNotification('Удаленное управление пользователем', NotificationStatus.info)
}

function onDenyRemoteControl(remoteController) {
    if (remoteAccess) {
        remoteAccess = false
        controlAccess = false
        $('#page-content').css('display', 'block')
        $('#screen').css('display', 'none')
        remoteController.addClass('scale-out')
        remoteController.removeClass('scale-in')
        remoteController.removeClass('red accent-4')
        remoteController.off('click')
    }
}

function onAllowRemoteControl(socket, remoteController) {
    if (!remoteAccess) {
        controlAccess = true
        remoteAccess = true
        controlBtnHandler(socket, remoteController)
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