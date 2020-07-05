'use strict'
/**
 *
 * Client utils
 *
 * **/
const screenshot = require('screenshot-desktop')
const fs = require('fs')

/** returns an arrayBuffer of desktop screenshot **/
exports.takeScreenShot = function() {
    return new Promise((resolve, reject) => {
        screenshot()
            .then(imgBuffer => {
                console.log(`screenshot has been taken, ${new Date()}`)
                resolve(imgBuffer)
            })
            .catch(err => {
                console.error(`taking screenshot failed, ${new Date()}`)
                console.error(err)
                reject()
            })
    })
}

/** save local screenshot **/
exports.saveScreenShot = function(bufferedData, name) {
    return new Promise((resolve, reject) => {
        fs.writeFile('./screens/' + name, bufferedData, err => {
            if (err) {
                console.error(`saving failed, ${new Date()}`)
                console.error(err)
                reject(err)
            }
            else {
                console.log(`screenshot has been saved on path: ${name}, ${new Date()}`)
                resolve()
            }
        })
    })
}

/** read screen from screens by name **/
exports.readScreenShotByName = function(name) {
    return new Promise((resolve, reject) => {
        fs.readFile(`${__dirname}/screens/${name}`, (err, data) => {
            if (err) {
                console.error(`reading screenshot by name failed, ${new Date()}`)
                console.error(err)
                reject()
            }
            else
                resolve(data)
        })
    })
}

/** send screenshot to recipient **/
exports.sendScreenShot = function(socket, fileName, data, isAnswered) {
    socket.emit('screenshot', {
        filename: fileName,
        buffer: data,
        answered: isAnswered
    })
}

/** returns name for new screenshot based on current date-time **/
exports.getScreenShotName = function(prefix) {
    const now = new Date()
    const hours = `0${now.getHours()}.`.slice(-3)
    const minutes = `0${now.getMinutes()}.`.slice(-3)
    const seconds = `0${now.getSeconds()}`.slice(-2)
    return `${prefix + hours + minutes + seconds}.png`
}

/** send old screens **/
exports.sendOld = async function(unsentScreens, socket) {
    console.log(`sending old screenshots, count: ${unsentScreens.length}, ${new Date()}`)
    for (const screen of unsentScreens) {
        const buf = await exports.readScreenShotByName(screen)
        if (screen.startsWith('new'))
            exports.sendScreenShot(socket, screen, buf, false)
        else
            exports.sendScreenShot(socket, screen, buf, true)
    }
}

/** helper func **/
exports.arrayEqual = function(arr_1, arr_2) {
    let res = true
    if (!arr_1 || !arr_2)
        return false

    if(arr_1.length !== arr_2.length)
        return false

    arr_1.forEach((item, i) => {
        if (item != arr_2[i])
            res = false
    })

    return res
}

exports.canSendToPeer = function (isConnected, jsonData, maxDataSize) {
    return isConnected &&
        Buffer.from(JSON.stringify(jsonData), 'utf8').length < maxDataSize
}