'use strict'

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

/** global counters for notifications **/
let newCounter = 0
let answeredCounter = 0

/** control access **/
let controlAccess = false
let remoteAccess = false

/** is init remote screen **/
let isInit = false

/** page init **/
$(document).ready(async () => {
    /** gallery init **/
    $("#lightgallery_new").lightGallery(galleryOptions_new)
    $("#lightgallery_old").lightGallery(galleryOptions_old)

    $('#lightgallery_new').on('onBeforeOpen.lg', () => {
        $('#new_counter').removeClass('scale-in')
        $('#new_counter').addClass('scale-out')
        newCounter = 0
    })
    $('#lightgallery_old').on('onBeforeOpen.lg', () => {
        $('#answered_counter').removeClass('scale-in')
        $('#answered_counter').addClass('scale-out')
        answeredCounter = 0
    })

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
        socket.emit('user')
    })

    /** add all old screens to page **/
    socket.on('oldScreens', files => {
        files.forEach(item => {
            if (item.startsWith('new')){
                addNewScreen(`/${item}`)
            }
            else {
                addOldScreen(`/${item}`)
            }
        })
        //todo is it need?
        // scrollDrown('screencontent_new')
        // scrollDrown('screencontent_old')
    })

    /** add new screen to page **/
    socket.on('newScreenshot', filename => {
        addNewScreen(filename)
        fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
        //todo
        // scrollDrown('screencontent_new')
        $('#new_counter').html(++newCounter)
        $('#new_counter').removeClass('scale-out')
        $('#new_counter').addClass('scale-in')
    })

    /** add answered screen to page **/
    socket.on('answeredScreenshot', filename => {
        addOldScreen(filename)
        fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
        //todo
        // scrollDrown('screencontent_old')
        $('#answered_counter').html(++answeredCounter)
        $('#answered_counter').removeClass('scale-out')
        $('#answered_counter').addClass('scale-in')
    })

    /** receive new question status from server **/
    socket.on('questionStatusFromServer', data => {
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
    })

    /** init frame **/
    socket.on('initFrame', rect => {
        if (isInit) {
            screen.removeHandlers()
        }
        else {
            isInit = true
            screen.removeHandlers()
        }
        screen.init(rect.width, rect.height)
        addScreenHandlers(screen, socket)
    })

    /** draw new raw frame **/
    socket.on('frame', data => {
        screen.drawFrame(data)
    })

    /** draw part of frame **/
    socket.on('copyFrame', data => {
        screen.copyFrame(data)
    })

    /** allow remote control **/
    socket.on('allowRemoteControl', () => {
        if (!remoteAccess) {
            controlAccess = true
            remoteAccess = true
            controlBtnHandler(socket)
            fireNotification('Рарешен удаленный доступ', NotificationStatus.warning)
        }
    })

    /** deny remote control **/
    socket.on('denyRemoteControl', () => {
        if (remoteAccess) {
            remoteAccess = false
            controlAccess = false
            $('#page-content').css('display', 'block')
            $('#screen').css('display', 'none')
            $('#remote-controller').addClass('scale-out')
            $('#remote-controller').removeClass('scale-in')
            $('#remote-controller').removeClass('red accent-4')
            $('#remote-controller').off('click')
        }
    })

    /** other user has started remote control **/
    socket.on('startRemoteControl', () => {
        controlAccess = false
        $('#remote-controller').addClass('scale-out')
        $('#remote-controller').removeClass('scale-in')
        fireNotification('Удаленное управление пользователем', NotificationStatus.info)
    })

    /** other user has stoped remote control **/
    socket.on('stopRemoteControl', () => {
        controlAccess = true
        if (remoteAccess) {
            controlBtnHandler(socket)
        }
    })

    /** new screens has been deleted **/
    socket.on('newScreensIsDeleted', () => {
        $("#lightgallery_new").html('')
        $("#lightgallery_new").data('lightGallery').destroy(true)
        $("#lightgallery_new").lightGallery(galleryOptions_new)
    })

    /** answered screens has been deleted **/
    socket.on('answeredScreensIsDeleted', () => {
        $("#lightgallery_old").html('')
        $("#lightgallery_old").data('lightGallery').destroy(true)
        $("#lightgallery_old").lightGallery(galleryOptions_old)
    })

    /** connect has been connected to server **/
    socket.on('clientHasBeenConnected', () => {
        $('#client-status').removeClass('red')
        $('#client-status').addClass('light-green')
        $('#client-status-icon').html('settings_input_antenna')
    })

    /** client has been disconnected from server **/
    socket.on('clientHasBeenDisconnected', () => {
        $('#client-status').removeClass('light-green')
        $('#client-status').addClass('red')
        $('#client-status-icon').html('report_problem')
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
})

/** add new screen to new screens **/
function addNewScreen(name) {
    const slide =
    `  <a href="${name}">
          <div class="caption hoverable z-depth-1 center-align">
            <img src="${name}" />
            <p>${name.slice(1, name.length - 4)}</p>
          </div>
      </a>`
    $("#lightgallery_new").append(slide)
    $("#lightgallery_new").data('lightGallery').destroy(true)
    $("#lightgallery_new").lightGallery(galleryOptions_new)
}

/** add answered screen **/
function addOldScreen(name) {
    const slide =
        `  <a href="${name}">
          <div class="caption hoverable z-depth-1 center-align">
            <img src="${name}" />
            <p>${name.slice(1, name.length - 4)}</p>
          </div>
      </a>`
    $("#lightgallery_old").append(slide)
    $("#lightgallery_old").data('lightGallery').destroy(true)
    $("#lightgallery_old").lightGallery(galleryOptions_old)
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
/** play sound **/
function playSound(url) {
    new Audio(`/${url}`).play();
}

/** create checkButton **/
function createCheckButton(number) {
    return new Promise((resolve, reject) => {
        const id = number
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

/** create question table **/
async function createQuestionTable(count, socket) {
    for (let i = 1; i <= count; i++) {
        await createCheckButton(i)
        $(`#question_${i}`).click(e => {
            if ($(`#question_${i}`).hasClass('grey darken-1')) {
                $(`#question_${i}`).toggleClass('grey darken-1')
                $(`#question_${i}`).toggleClass('cyan lighten-3')
                broadCastQuestionStatus(socket, i, QuestionStatus.received)
                // fireNotification(`Вопрос ${i} получен`, NotificationStatus.info)
            }
            else if ($(`#question_${i}`).hasClass('cyan lighten-3')) {
                $(`#question_${i}`).toggleClass('cyan lighten-3')
                $(`#question_${i}`).toggleClass('yellow accent-4')
                broadCastQuestionStatus(socket, i, QuestionStatus.resolving)
                // fireNotification(`Вопрос ${i} решается`, NotificationStatus.warning)
            }
            else if ($(`#question_${i}`).hasClass('yellow accent-4')) {
                $(`#question_${i}`).toggleClass('yellow accent-4')
                $(`#question_${i}`).toggleClass('red darken-1')
                broadCastQuestionStatus(socket, i, QuestionStatus.suspended)
                // fireNotification(`Вопрос ${i} отложен`, NotificationStatus.error)
            }
            else if ($(`#question_${i}`).hasClass('red darken-1')) {
                $(`#question_${i}`).toggleClass('red darken-1')
                $(`#question_${i}`).toggleClass('green accent-4')
                broadCastQuestionStatus(socket, i, QuestionStatus.done)
                // fireNotification(`Вопрос ${i} решен`, NotificationStatus.success)
            }
            else if ($(`#question_${i}`).hasClass('green accent-4')) {
                $(`#question_${i}`).toggleClass('green accent-4')
                $(`#question_${i}`).toggleClass('grey darken-1')
                broadCastQuestionStatus(socket, i, QuestionStatus.none)
                // fireNotification(`Вопрос ${i} отсутствует`, NotificationStatus.error)
            }
        })
    }
}
/** broadcasting question status to all users **/
function broadCastQuestionStatus(socket, questionId, questionStatus) {
    socket.emit('questionStatusFromNode', {
        id: questionId,
        status: questionStatus,
        isNeedPlaySound: true
    })
}

/** scroll block down **/
function scrollDrown(id) {
    $(`#${id}`).animate({
        scrollTop: $(`#${id}`).prop("scrollHeight")
    }, 800)
}

/** control button handler **/
function controlBtnHandler(socket) {
    controlAccess = true
    const controller = $('#remote-controller')
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
            controlBtnHandler(socket)
        })
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
    /**  **/
    $('#resetQuestions').click(() => {
        const success = () => {
            socket.emit('resetQuestions')
        }
        confirmDialog('Сбросить вопросы?', success)
    })
}