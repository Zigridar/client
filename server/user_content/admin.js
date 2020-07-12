'use strict'

$(document).ready(async () => {
    /** init jQuery constants **/

    /** system variables **/
    const userStatus = $('#user-status')
    const userStatusIcon = $('#user-status-icon')
    const exitBtn = $('#exit-btn')
    const userTableBody = $('#users-col')
    const tokenScreenBody = $('#s-token-col')
    const tokenQuestionBody = $('#q-token-col')
    const galleryNew = $("#lightgallery_new")
    const galleryOld = $("#lightgallery_old")
    const deleteNewBtn = $('#delete-new')
    const deleteOldBtn = $('#delete-old')
    const resetQuestionsBtn = $('#reset-questions')
    const questionContainer = $('#question_card')
    const galleryNewHeader = $('#gallery-new-header')
    const galleryOldHeader = $('#gallery-old-header')
    const questionsHeader = $('#questions-header')

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
        addUserToCol(user, userTableBody, userCard, socket)
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
        addUserToCol(user, userTableBody, userCard, socket)
    })

    /** new token **/
    socket.on('newToken', token => {
        addTokenToScreenCol(token, tokenScreenBody, socket, galleryNew, galleryOld, galleryNewHeader, galleryOldHeader)
        addTokenToQuestionCol(token, tokenQuestionBody, socket, resetQuestionsBtn, questionContainer, questionsHeader)
    })

    /** get screens for selected token **/
    socket.on('screensForToken', (files, token) => {
        files.forEach(item => {
            if (item.startsWith('new')){
                addNewScreen(`/${item}`, token, galleryNew)
            }
            else {
                addOldScreen(`/${item}`, token, galleryOld)
            }
        })

        addDeleteBtnHandlers(deleteNewBtn, deleteOldBtn, token, socket, galleryNew, galleryOld)
    })

    /** question for token from server **/
    socket.on('questionStatusForToken', (questionStatus, token) => {
        if (questionContainer.token === token)
            onQuestionChange(questionStatus)
    })

    /** init page **/
    initAdminPage(
        userCard,
        exitBtn,
        galleryNew,
        galleryOld,
        socket
    )
})