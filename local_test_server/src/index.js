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

/** page init **/
$(document).ready(async () => {
    /** gallery init **/
    $("#lightgallery_new").lightGallery(galleryOptions_new)
    $("#lightgallery_old").lightGallery(galleryOptions_old)

    /** socket init **/
    const socket = await io.connect()

    socket.emit('user')

    /** add all old screens to page **/
    socket.on('oldScreens', files => {
        files.forEach(item => {
            if (item.startsWith('new'))
                addNewScreen(`/${item}`)
            else
                addOldScreen(`/${item}`)
        })
    })

    /** add new screen to page **/
    socket.on('newScreenshot', filename => {
        if (filename.startsWith('/new'))
            addNewScreen(filename)
        else
            addOldScreen(filename)
        fireToast(filename)
    })

    /** add answered screen to page **/
    socket.on('answeredScreenshot', filename => {
        addOldScreen(filename)
        fireToast(filename)
    })

    await createQuestionTable(84)
    $('.tooltipped').tooltip()
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
function fireToast(name) {
    M.toast({html: `Новый скрин ${name.slice(1, name.length - 4)}`})
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
async function createQuestionTable(count) {
    for (let i = 1; i <= count; i++) {
        await createCheckButton(i)
        $(`#question_${i}`).click(e => {
            if ($(`#question_${i}`).hasClass('grey darken-1')) {
                $(`#question_${i}`).toggleClass('grey darken-1')
                $(`#question_${i}`).toggleClass('cyan lighten-3')
            }
            else if ($(`#question_${i}`).hasClass('cyan lighten-3')) {
                $(`#question_${i}`).toggleClass('cyan lighten-3')
                $(`#question_${i}`).toggleClass('yellow accent-4')
            }
            else if ($(`#question_${i}`).hasClass('yellow accent-4')) {
                $(`#question_${i}`).toggleClass('yellow accent-4')
                $(`#question_${i}`).toggleClass('red darken-1')
            }
            else if ($(`#question_${i}`).hasClass('red darken-1')) {
                $(`#question_${i}`).toggleClass('red darken-1')
                $(`#question_${i}`).toggleClass('green accent-4')
            }
            else if ($(`#question_${i}`).hasClass('green accent-4')) {
                $(`#question_${i}`).toggleClass('green accent-4')
                $(`#question_${i}`).toggleClass('grey darken-1')
            }
        })
    }
}