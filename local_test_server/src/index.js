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
    const screen = new Screen(getCanvas('screen'))

    /** socket init **/
    const socket = await io.connect()

    socket.emit('user')

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
        scrollDrown('screencontent_new')
        scrollDrown('screencontent_old')
    })

    /** add new screen to page **/
    socket.on('newScreenshot', filename => {
        addNewScreen(filename)
        fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
        scrollDrown('screencontent_new')
        $('#new_counter').html(++newCounter)
        $('#new_counter').removeClass('scale-out')
        $('#new_counter').addClass('scale-in')
    })

    /** add answered screen to page **/
    socket.on('answeredScreenshot', filename => {
        addOldScreen(filename)
        fireNotification(`Получени новый скрин ${filename.substr(1, filename.length - 1)}`, NotificationStatus.info)
        scrollDrown('screencontent_old')
        $('#answered_counter').html(++answeredCounter)
        $('#answered_counter').removeClass('scale-out')
        $('#answered_counter').addClass('scale-in')
    })

    /** receive new question status from server **/
    socket.on('questionStatusFromServer', data => {
        $(`#question_${data.id}`).removeClass('grey darken-1 cyan lighten-3 yellow accent-4 red darken-1 green accent-4')
        let newStyleClass = ''
        if (data.status == QuestionStatus.none) {
            fireNotification(`Вопрос ${data.id} отсутствует`, NotificationStatus.error, data.isNeedPlaySound)
            newStyleClass = 'grey darken-1'
        }
        else if (data.status == QuestionStatus.received) {
            newStyleClass = 'cyan lighten-3'
            fireNotification(`Вопрос ${data.id} получен`, NotificationStatus.info, data.isNeedPlaySound)
        }
        else if (data.status == QuestionStatus.resolving) {
            newStyleClass = 'yellow accent-4'
            fireNotification(`Вопрос ${data.id} решается`, NotificationStatus.warning, data.isNeedPlaySound)
        }
        else if (data.status == QuestionStatus.suspended) {
            newStyleClass = 'red darken-1'
            fireNotification(`Вопрос ${data.id} отложен`, NotificationStatus.error, data.isNeedPlaySound)
        }
        else if (data.status == QuestionStatus.done) {
            newStyleClass = 'green accent-4'
            fireNotification(`Вопрос ${data.id} решен`, NotificationStatus.success, data.isNeedPlaySound)
        }
        $(`#question_${data.id}`).addClass(newStyleClass)
    })

    /** draw new raw frame **/
    socket.on('rawFrame', data => {
        //todo remove
        console.log('update')
        screen.drawFrame(data)
    })

    /** draw part of frame **/
    socket.on('copyFrame', data => {
        console.log('copy frame')
        screen.copyFrame(data)
    })

    /** creating the question table **/
    await createQuestionTable(84, socket)
    /** tooltip init **/
    $('.tooltipped').tooltip()
    playSound('windows.wav')
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

/** fire notification **/ //todo sound
function fireNotification(text, notificationStatus, isNeedPlaySound) {
    Swal.fire({
        title: text,
        type: notificationStatus,
        toast: true,
        position: 'top-end',
        timer: 4000,
        showConfirmButton: false,
        background: '#cbf7f4'
    });
    if (isNeedPlaySound)
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