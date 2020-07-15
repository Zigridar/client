'use strict'

/** constructor **/
function Screen(canvas) {
    this._event = new EventEmitter();
    this._canvas = canvas;
    this._context = canvas.getContext('2d');
    this._hasHandlers = false;
    this._scaleFactor = 1;
    this._dx = 0;
    this._dy = 0;
    canvas.width = 800;
    canvas.height = 600;

    this._context.imageSmoothingEnabled = false;
    this._context.mozImageSmoothingEnabled = false;
    this._context.webkitImageSmoothingEnabled = false;
    this._context.msImageSmoothingEnabled = false;

    this._scale = this._scale.bind(this);
    this._scale();
    this.on = this._event.on.bind(this._event);
    this.removeListener = this._event.removeListener.bind(this._event);
    this.canMouseMove = true
}

/** draw frame from raw data **/
Screen.prototype.drawFrame = function(rect) {
    const image = rect.image;
    if (image.encoding === 'raw') {
        const imageData = this._context.createImageData(rect.width, rect.height);
        imageData.data.set(new Uint8Array(image.data));
        this._context.putImageData(imageData, rect.x, rect.y);
    }
};

/** draw copy frame **/
Screen.prototype.copyFrame = function(rect) {
    const imageData = this._context.getImageData(rect.src.x, rect.src.y, rect.width, rect.height);
    this._context.putImageData(imageData, rect.x, rect.y)
};

/** scale screen with browser window **/
Screen.prototype._scale = function() {
    const canvas = this._canvas,
        sw = (window.innerWidth * 0.9) / canvas.width,
        sh = (window.innerHeight * 0.9) / canvas.height,
        s = Math.min(sw, sh);

    this._scaleFactor = s;
    this._dx = (window.innerWidth - canvas.width * s) / 2 / s;
    this._dy = (window.innerHeight - canvas.height * s) / 2 / s;
    const transform = 'scale(' + s + ') translate(' +
        this._dx + 'px, ' + this._dy + 'px)';
    canvas.style.mozTransform = transform;
    canvas.style.webkitTransform = transform;
    canvas.style.transform = transform;
};

/** helper func **/
Screen.prototype._toScreenX = function(pageX){
    return (pageX ) / this._scaleFactor - this._dx;
}

Screen.prototype._toScreenY = function(pageY){
    return (pageY ) / this._scaleFactor - this._dy - 100;
}

/** add screen handlers **/
Screen.prototype._addHandlers = function() {
    if(this._hasHandlers)
        throw new Error("Event Handlers already attached!");

    const self = this;
    this._hasHandlers = true;

    /** mouse events **/
    let state = 0;
    this._canvas.addEventListener('mousedown', self._onmousedown = function(e) {
        state = 1;
        self._event.emit('mouseEvent', self._toScreenX(e.pageX) , self._toScreenY(e.pageY), state)
        e.preventDefault();
    }, false);
    this._canvas.addEventListener('mouseup', self._onmouseup = function (e) {
        state = 0;
        self._event.emit('mouseEvent', self._toScreenX(e.pageX) , self._toScreenY(e.pageY), state)
        e.preventDefault();
    }, false);
    this._canvas.addEventListener('mousemove', self._onmousemove = function (e) {
        if (self.canMouseMove) {
            self.canMouseMove = false
            self._event.emit('mouseEvent', self._toScreenX(e.pageX) , self._toScreenY(e.pageY), state)
            e.preventDefault();
            setTimeout(() => {self.canMouseMove = true}, 60)
        }
    });

    /** key events **/
    document.addEventListener('keydown', self._onkeydown = function (e) {
        self._event.emit('keyEvent', e.keyCode, e.shiftKey, 1)
        e.preventDefault();
    }, false);
    document.addEventListener('keyup', self._onkeyup = function (e) {
        self._event.emit('keyEvent', e.keyCode, e.shiftKey, 0)
        e.preventDefault();
    }, false);

    /** window resize **/
    window.addEventListener('resize', self._scale);
};

Screen.prototype.init = function(width, height){
    this._canvas.width = width;
    this._canvas.height = height;
    this._scale();
    this._addHandlers();
}

Screen.prototype.removeHandlers = function() {

    const self = this

    if(!self._hasHandlers)
        return;

    self._canvas.removeEventListener('mouseup', self._onmouseup);
    self._canvas.removeEventListener('mousedown', self._onmousedown);
    self._canvas.removeEventListener('mousemove', self._onmousemove);
    document.removeEventListener('keydown', self._onkeydown);
    document.removeEventListener('keyup', self._onkeyup);
    window.removeEventListener('resize', self._scale)
    self._hasHandlers = false;
};