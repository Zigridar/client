'use strict'
const rfb = require('rfb2')
//todo
const png = require('//todo')

const clients = []

/** create connection **/
module.exports.createRfbConnection = function(config, socket) {
    const r = rfb.createConnection({
        host: config.host,
        port: config.port,
        password: config.password
    })
    addEventHandlers(r, socket)
    return r
}

/** add event listeners for rfb connection **/
function addEventHandlers(r, socket) {
    /** connection event **/
    r.on('connect', () => {
        socket.emit('init', {
            width: r.width,
            height: r.height
        })
        clients.push({
            socket: socket,
            rfb: r
        })
    })
    /** new screen **/
    r.on('rect', rect => {
        //todo func
        handleFrame(socket, rect, r)
    })
}

function handleFrame(socket, rect, r) {
    //todo func
    const rgb = new ArrayBuffer(rect.width * rect.height)
}