Promise   = require 'bluebird'
_         = require 'lodash'
colors    = require 'colors'
path      = require 'path'
fsx       = require 'fs-extra'
inquirer  = require 'inquirer'

TOKEN_PATH = "/data/auth.json"

{ client_id, client_secret, redirect_uris } = require('../client.json').installed

{ google } = require 'googleapis'

scope = [
  'https://www.googleapis.com/auth/plus.me'
  'https://www.googleapis.com/auth/drive.file'
  'https://www.googleapis.com/auth/drive'
  'https://www.googleapis.com/auth/drive.metadata.readonly'
]

oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
)

self = (cmd) ->
  await fsx.ensureDir path.dirname TOKEN_PATH
  oauth2Client.setCredentials {
    refresh_token: '/data/auth.json'
  }

  tokenExists = await fsx.exists TOKEN_PATH
  if tokenExists
    tokens = await fsx.readJson TOKEN_PATH
    oauth2Client.setCredentials tokens

  drive = google.drive {
    version: 'v3',
    auth: oauth2Client
  }

  unless _.isString cmd.code
    console.log colors.bold.green " >> Generate Login url"
    console.log oauth2Client.generateAuthUrl {
      access_type: 'offline',
      scope
    }
  else
    { tokens } = await oauth2Client.getToken cmd.code

    console.log "Store access token to '#{TOKEN_PATH}'"
    await fsx.writeJson TOKEN_PATH, tokens

  # { email, password } = await inquirer
  #   .prompt [{
  #     type: 'input'
  #     name: 'email'
  #     massage: 'Email:'
  #   }, {
  #     type: 'password'
  #     name: 'password'
  #     massage: 'Password'
  #   }]
  # console.log email, password
module.exports = self