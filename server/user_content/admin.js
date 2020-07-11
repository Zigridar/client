'use strict'

$(document).ready(async () => {
    /** init jQuery constants **/

    /** system variables **/
    const userStatus = $('#user-status')
    const userStatusIcon = $('#user-status-icon')
    const exitBtn = $('#exit-btn')

    /** edit user variables **/
    const userCard = {
        firstName: $('#first-name'),
        lastName: $('#last-name'),
        login: $('#login-field'),
        password: $('#password'),
        token: $('#token-field'),
        genTokenBtn: $('#token-btn'),
        beginDate: $('#begin-date'),
        endDate: $('#end-date'),
        userAccess: $('#user-access'),
        adminAccess: $('#admin-access'),
        submitBtn: $('#submit-btn'),
        deleteBtn: $('#delete-btn'),
        clearBtn: $('#clear-btn')
    }

    const tableBody = $('#users-col')

    /** socket init **/
    const socket = await io.connect({
        forceNew: true,
        transports: ['websocket'],
        allowUpgrades: false,
        pingTimeout: 30000
    })


    /** init server admin **/
    socket.on('connect', () => {
        socket.emit('admin', document.cookie)
        onSocketConnect(userStatus, userStatusIcon)
    })

    /** admin has been disconnected from server **/
    socket.on('disconnect', () => {
        onSocketDisconnect(userStatus, userStatusIcon)
    })

    /** add user **/
    socket.on('addUser', user => {
        addUserToCol(user, tableBody, userCard, socket)
    })

    socket.on('editUser', user => {
        updateUser(user)
    })

    /** delete user from col **/
    socket.on('deleteUser', userId => {
        deleteUserFromCol(userId, userCard)
    })

    /** receive user from server **/
    socket.on('userForAdmin', user => {
        addUserToCol(user, tableBody, userCard, socket)
    })

    /** init page **/
    initAdminPage(userCard, exitBtn, socket)
})