'use strict'
const rfb = require('rfb2')
const EventEmitter = require('events')

/** max count of attempt to reconnect **/
const MAX_ATTEMPT = 5

/** constructor **/
function RFB(options) {
    this._event = new EventEmitter()
    this.on = this._event.on.bind(this._event)
    this._rfbConnection = null
    this._options = options
    this._attemptCounter = 0
    /** init connection after creation using "new" keyword **/
    this.init()
}

/** init RFB connection **/
RFB.prototype.init = function() {
    const self = this
    /** create connection **/
    self._rfbConnection = rfb.createConnection(self._options)

    /**
     *
     * add event handlers
     *
     * **/

    /** RFB error **/
    self._rfbConnection.on('error', err => {
        console.error(`RFB ERROR, ${new Date()}`)
        console.error(err)
        if (self._attemptCounter < MAX_ATTEMPT) {
            console.log(`RFB reconnect, ${new Date()}`)
            self._rfbConnection = 0
            self._attemptCounter++
            self.init()
        }
    })

    /** RFB connect event **/
    self._rfbConnection.on('connect', () => {
        self._rfbConnection.autoUpdate = true
        console.log(`RFB connection, ${new Date()}`)
    })

    /** update screen event **/
    self._rfbConnection.on('rect', rect => {
        switch (rect.encoding) {
            case rfb.encodings.raw:
                self._event.emit('rawRect', rect)
                break;
            case rfb.encodings.copyRect:
                self._event.emit('copyRect', rect)
                break;
        }
    })
}

/** key event handler **/
RFB.prototype.keyEvent = function(keyboard) {
    const self = this
    try {
        self._rfbConnection.keyEvent(keyboard.keyCode, keyboard.isDown)
    }
    catch (e) {
        console.error(`failed key event, ${new Date()}`)
        console.error(e)
    }
}

/** mouse event handler **/
RFB.prototype.mouseEvent = function(mouse) {
    const self = this
    try {
        self._rfbConnection.pointerEvent(mouse.x, mouse.y, mouse.button)
    }
    catch (e) {
        console.error(`failed mouse event, ${new Date()}`)
        console.error(e)
    }
}

/** update screen **/
RFB.prototype.updateScreen = function() {
    const self = this
    if (self._rfbConnection) {
        try {
            self._rfbConnection.requestUpdate(false,0, 0, self._rfbConnection.width, self._rfbConnection.height)
        }
        catch (e) {
            console.error(`failed request update, ${new Date()}`)
            console.error(e)
        }
    }
}

/** constructor export **/
module.exports = RFB