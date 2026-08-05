const { initializeApp } = require('firebase-admin/app')

initializeApp()

const {
  connectGmailAccount, disconnectGmailAccount, sendMail, sendBulkMail,
  trackOpen, trackClick, unsubscribe,
} = require('./mailing')
const { syncUserClaims } = require('./customClaims')

exports.connectGmailAccount = connectGmailAccount
exports.disconnectGmailAccount = disconnectGmailAccount
exports.sendMail = sendMail
exports.sendBulkMail = sendBulkMail
exports.trackOpen = trackOpen
exports.trackClick = trackClick
exports.unsubscribe = unsubscribe
exports.syncUserClaims = syncUserClaims
