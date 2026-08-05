const { OAuth2Client } = require('google-auth-library')

// El Client ID no es secreto - se define como variable de entorno normal de la función
// (ver functions/.env, GOOGLE_OAUTH_CLIENT_ID). El Client Secret sí, se pasa como secret de Firebase.
function createOAuth2Client(clientSecret) {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret,
    redirectUri: 'postmessage', // obligatorio con ux_mode:'popup' de Google Identity Services
  })
}

module.exports = { createOAuth2Client }
