'use strict'
const crypto = require('crypto')
const fs = require('fs')
const config = require('../serverConfig')

/** remove screens **/
exports.removeScreens =  async function(isNew, io, Rooms) {
    let files = await exports.readDirFiles(__dirname + '/../screens')

    if (isNew)
        files = files.filter(fileName => fileName.startsWith('new'))
    else
        files = files.filter(fileName => fileName.startsWith('answered'))

    files.forEach(fileName => {
        fs.unlink(__dirname + `/../screens/${fileName}`, () => {})
    })

    if (isNew)
        io.in(Rooms.users).emit('newScreensIsDeleted')
    else
        io.in(Rooms.users).emit('answeredScreensIsDeleted')
    console.log(`delete screens, isNew: ${isNew}, ${new Date()}`)
}


/** read all files in the directory **/
exports.readDirFiles = function(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err)
                reject()
            else
                resolve(files)
        })
    })
}

/** encode and send frame using sender func **/
exports.encodeAndSendFrame = function(user, rect, sender) {
    const length = rect.data.length
    const rgba = new Buffer(length)
    for (let i = 0; i < length; i += 4) {
        rgba[i] = rect.data[i + 2]
        rgba[i + 1] = rect.data[i + 1]
        rgba[i + 2] = rect.data[i]
        rgba[i + 3] = 0xff
    }
    sender(user, rect, rgba, config.format)
}

/** helper function **/
exports.sendFrame = function(user, rect, image, format) {
    if (user)
        user.emit('frame', {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            image: {
                encoding: format,
                data: image
            }
        })
}

/** convert to RFB key code **/
exports.toRfbKeyCode = function(code, shift) {
    const keys = config.keyMap[code.toString()];
    if (keys) {
        return keys[shift ? 1 : 0];
    }
    return null
}

/** auth token for user session **/
exports.generateAuthToken = function() {
    return crypto.randomBytes(30).toString('hex')
}

/** returns hash of the password **/
exports.getHashedPassword = function(password) {
    const sha256 = crypto.createHash('sha256')
    const hash = sha256.update(password).digest('base64')
    return hash
}

/** save screen to "screens" dir **/
exports.saveScreen = async function(fileName, data, callback) {
    fs.writeFile(`${__dirname}/../screens/${fileName}`, data, callback)
}

/** load users from users.json **/
exports.loadUsers = function() {
    return new Promise((resolve, reject) => {
        fs.readFile(__dirname + `/../users.json`, (err, data) => {
            if (err) {
                const newUsers = {users: []}
                fs.writeFile(__dirname + `/../users.json`, JSON.stringify(newUsers), _err => {
                    if (_err)
                        reject({users: []})
                    else
                        resolve(newUsers)
                })
            }
            else
                resolve(JSON.parse(data))
        })
    })
}

/** save users JSON **/
exports.saveUsers = function(users) {
    return new Promise(async (resolve, reject) => {
        fs.writeFile(__dirname + '/../users.json', JSON.stringify({users: users}), err => {
            if (err)
                reject()
            else
                resolve()
        })
    })
}
