'use strict'

/** returns the canvas tag **/
function getCanvas(id) {
    return document.getElementById(id)
}

let arr = []

function setup () {
    createCanvas(1378, 766)
}

function draw() {
    loadPixels()
    pixels = arr
    updatePixels()
}

/** Frame constructor **/
function Screen(canvas) {
    this._canvas = canvas
    this._context = canvas.getContext('2d')
    // canvas.width = 800
    // canvas.height = 600

    // this._context.imageSmoothingEnabled = false;
    // this._context.mozImageSmoothingEnabled = false;
    // this._context.webkitImageSmoothingEnabled = false;
    // this._context.msImageSmoothingEnabled = false;
}

/** draw frame **/
Screen.prototype.drawFrame = function (rect) {
    arr = rect.image
    // this._canvas.width = rect.width
    // this._canvas.height = rect.height
    // console.log(rect)
    // const imgData = this._context.createImageData(rect.width, rect.height)
    // imgData.data.set(new Uint8Array(rect.image))
    // this._context.putImageData(imgData, rect.x, rect.y)
    console.log('update')
}