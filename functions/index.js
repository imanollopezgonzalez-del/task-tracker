const { initializeApp } = require('firebase-admin/app')

initializeApp()

const { connectGmailAccount, disconnectGmailAccount, sendMail } = require('./mailing')

exports.connectGmailAccount = connectGmailAccount
exports.disconnectGmailAccount = disconnectGmailAccount
exports.sendMail = sendMail
