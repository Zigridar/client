'use strict'

/** date picker options **/
const datePickerOptions = {
    format: 'dd.mm.yyyy'
}

/** date pattern **/
const datePattern = /\d{2}\.\d{2}\.\d{4}/

/** init admin page **/
function initAdminPage(
    userCard,
    exitBtn,
    galleryNew,
    galleryOld,
    socket
) {
    $('.tabs').tabs()
    $('.datepicker').datepicker(datePickerOptions)
    $('.tooltipped').tooltip()
    initUserForm(userCard, socket)
    /** init exit button **/
    exitBtn.click(() => {
        exitButtonHandler(socket)
    })
    /** gallery init **/
    galleryNew.lightGallery(galleryOptions_new)
    galleryOld.lightGallery(galleryOptions_old)

}

/** init user form **/
function initUserForm(userCard, socket) {
    /** click save button **/
        userCard.submitBtn.click(e => {
        /** validate user form after save **/
        const check = validateUser(
            userCard.firstName,
            userCard.lastName,
            userCard.login,
            userCard.password,
            userCard.token,
            userCard.beginDate,
            userCard.endDate
        )
        if (check) {
            /** emit to server **/
            socket.emit('addUser', {
                id: userCard.id,
                firstName: userCard.firstName.val(),
                lastName: userCard.lastName.val(),
                login: userCard.login.val(),
                password: userCard.password.val(),
                token: userCard.token.val(),
                beginDate: userCard.beginDate.val(),
                endDate: userCard.endDate.val(),
                userAccess: userCard.userAccess.prop('checked'),
                adminAccess: userCard.adminAccess.prop('checked')
            })
            /** clear form **/
            clearForm(userCard)
        }
        else
            errorDialog('Invalid data')
    })

    /** click token button **/
    userCard.genTokenBtn.click(() => {
        userCard.token.val(generateTeamToken())
    })

    /** clear card **/
    userCard.clearBtn.click(() => {
        clearForm(userCard)
    })

}

/** validate user form **/
function validateUser(
    firstName,
    lastName,
    login,
    password,
    token,
    startDate,
    endDate
) {
    return nonEmptyString(firstName) &&
    nonEmptyString(lastName) &&
    nonEmptyString(login) &&
    nonEmptyString(password) &&
    nonEmptyString(token) &&
    nonEmptyString(startDate) &&
    nonEmptyString(endDate) &&
    datePattern.test(startDate.val()) &&
    datePattern.test(endDate.val())
}

/** non empty text field **/
function nonEmptyString(elem) {
    return elem && elem.val().trim() !== ''
}

/**
 * generate new token
 *
 * It's the unique token for one team
 *
 * **/
function generateTeamToken() {
    return (Math.random().toString(36)).substring(2, 7) + (Math.random().toString(36)).substring(2, 7)
}

/** clear user form **/
function clearForm(userCard) {
    userCard.id = null
    userCard.firstName.val('')
    userCard.lastName.val('')
    userCard.login.val('')
    userCard.password.val('')
    userCard.token.val('')
    userCard.beginDate.val('')
    userCard.endDate.val('')
    userCard.userAccess.prop('checked', false)
    userCard.adminAccess.prop('checked', false)
    userCard.deleteBtn.off()
    userCard.deleteBtn.addClass('disabled')
}

/** fill user card **/
function fillUserCard(userCard, user, socket) {
    clearForm(userCard)
    userCard.id = user.id
    userCard.firstName.val(user.firstName)
    userCard.lastName.val(user.lastName)
    userCard.login.val(user.login)
    userCard.token.val(user.token)
    userCard.beginDate.val(user.beginDate)
    userCard.endDate.val(user.endDate)
    userCard.password.val(user.password)
    userCard.userAccess.prop('checked', user.userAccess)
    userCard.adminAccess.prop('checked', user.adminAccess)
    /** delete btn handlers **/
    userCard.deleteBtn.off()
    userCard.deleteBtn.removeClass('disabled')
    userCard.deleteBtn.click(() => {
        socket.emit('deleteUser', user.id)
        clearForm(userCard)
    })
}

/** add user to col after saving **/
function addUserToCol(user, tableBody, userCard, socket) {
    /** create row **/
    const row =
        `
    <tr id="${user.id}">
        <td>${user.lastName}</td>
        <td>${user.firstName}</td>
        <td>${user.login}</td>
        <td>${user.beginDate}</td>
        <td>${user.endDate}</td>
        <td>${user.token}</td>
        <td>
            <a id="copy-token-btn-${user.id}" class="btn-floating btn-small waves-effect waves-light small"><i class="material-icons left">content_copy</i></a>
        </td>
        <td style="display: none">
            <div id="user-container-${user.id}">${JSON.stringify(user)}</div>
        </td>
    </tr>
    `
    /** add user to col **/
    tableBody.prepend(row)
    /** add item dblclick listener **/
    $(`#${user.id}`).dblclick(() => {
        fillUserCard(userCard, JSON.parse($(`#user-container-${user.id}`).html()), socket)
    })

    /** copy user token **/
    $(`#copy-token-btn-${user.id}`).click(() => {
        const temp = $("<input>")
        $(`body`).append(temp)
        temp.val($(`#${user.id}`).children(`:nth-child(6)`).text()).select()
        document.execCommand(`copy`)
        temp.remove()
    })
}

/** remove user from col **/
function deleteUserFromCol(userId, userCard) {
    $(`#${userId}`).remove()
    if (userCard.id === userId)
        clearForm(userCard)
}

/** update user **/
function updateUser(user) {
    const parentNode = $(`#${user.id}`)
    parentNode.children(`:nth-child(1)`).html(user.lastName)
    parentNode.children(`:nth-child(2)`).html(user.firstName)
    parentNode.children(`:nth-child(3)`).html(user.login)
    parentNode.children(`:nth-child(4)`).html(user.beginDate)
    parentNode.children(`:nth-child(5)`).html(user.endDate)
    parentNode.children(`:nth-child(6)`).html(user.token)
    $(`#user-container-${user.id}`).html(JSON.stringify(user))
}

/** add new token to col **/
function addTokenToCol(token, tokenTableBody, socket, galleryNew, galleryOld) {
    const row =
        `
        <tr id="token-${token}">
            <td>${token}</td>
        </tr>
        `
    tokenTableBody.prepend(row)

    $(`#token-${token}`).dblclick(() => {
        /** reset gallery **/
        galleryNew.html('')
        galleryOld.html('')
        socket.emit('requestScreenForToken', token)
    })
}

/** delete button handlers **/
function addDeleteBtnHandlers(deleteNewBtn, deleteOldBtn, token, socket, galleryNew, galleryOld) {
    /** reset handlers **/
    deleteNewBtn.off()
    deleteOldBtn.off()

    /** for new **/
    deleteNewBtn.click(() => {
        const success = () => {
            socket.emit('deleteNewForToken', token)
            galleryNew.html('')
        }
        confirmDialog(`Do you really want to delete all new screens for token ${token}?`, success)
    })

    /** for old **/
    deleteOldBtn.click(() => {
        const success = () => {
            socket.emit('deleteOldForToken', token)
            galleryOld.html('')
        }
        confirmDialog(`Do you really want to delete all answered screens for token ${token}?`, success)
    })
}