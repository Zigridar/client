'use strict'

/** gallery options **/
const galleryOptions = {
    loop: false,
    thumbnail: true,
    showThumbByDefault: false,
    share: false,
    autoplay: false,
    autoplayControls: false,
    subHtmlSelectorRelative: true,
    html: true
}

/** page init **/
$(document).ready(function() {
    /** gallery init **/
    $("#lightgallery").lightGallery(galleryOptions)

    /** socket init **/
    const socket = io.connect()

    socket.emit('user')

    /** add all old screens to page **/
    socket.on('oldScreens', files => {
        files.forEach(item => {
            addNewImage(`/${item}`)
        })
    })

    /** add new screen to page **/
    socket.on('newScreenshot', filename => {
        addNewImage(filename)
        fireToast(filename)
    })

})

/** add new item to gallery **/
function addNewImage(name) {
    const slide =
    `  <a href="${name}">
          <div class="caption">
            <img src="${name}" />
            <p>${name.slice(1, name.length - 4)}</p>
          </div>
      </a>`
    $("#lightgallery").append(slide)
    $("#lightgallery").data('lightGallery').destroy(true)
    $("#lightgallery").lightGallery(galleryOptions)
}

function fireToast(name) {
    M.toast({html: `Новый скрин ${name.slice(1, name.length - 4)}`})
}