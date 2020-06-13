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
$(document).ready(function() {
    /** gallery init **/
    $("#lightgallery_new").lightGallery(galleryOptions_new)
    $("#lightgallery_old").lightGallery(galleryOptions_old)

    /** socket init **/
    const socket = io.connect()

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

})

/** add new screen to new screens **/
function addNewScreen(name) {
    const slide =
    `  <a href="${name}">
          <div class="caption">
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
          <div class="caption">
            <img src="${name}" />
            <p>${name.slice(1, name.length - 4)}</p>
          </div>
      </a>`
    $("#lightgallery_old").append(slide)
    $("#lightgallery_old").data('lightGallery').destroy(true)
    $("#lightgallery_old").lightGallery(galleryOptions_old)
}

function fireToast(name) {
    M.toast({html: `Новый скрин ${name.slice(1, name.length - 4)}`})
}