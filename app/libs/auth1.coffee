Promise   = require 'bluebird'
_         = require 'lodash'
colors    = require 'colors'
fsx       = require 'fs-extra'
highlight = require('cli-highlight').highlight
inquirer  = require 'inquirer'
moment    = require 'moment'
path      = require 'path'
yaml      = require 'js-yaml'

TOKEN_PATH = "/data/auth.json"

{ client_id, client_secret, redirect_uris } = require('../client.json').installed

client_id = process.env.CLIENT_ID if _(process.env).has 'CLIENT_ID'
client_secret = process.env.CLIENT_SECRET if _(process.env).has 'CLIENT_SECRET'

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

self = ->
  await fsx.ensureDir path.dirname TOKEN_PATH
  oauth2Client.setCredentials {
    refresh_token: TOKEN_PATH
  }

  tokenExists = await fsx.exists TOKEN_PATH
  if tokenExists
    tokens = await fsx.readJson TOKEN_PATH
    oauth2Client.setCredentials tokens

  drive = google.drive {
    version: 'v3',
    auth: oauth2Client
  }

  oauth2Client.on 'tokens', (tokens) ->
    false
    # if tokens.refresh_token
    #   console.log '--- refresh token! ---'
    #   console.log tokens.refresh_token

  {
    oauth2Client,
    drive,
    generateUrl: ->
      console.log oauth2Client.generateAuthUrl {
        access_type: 'offline',
        scope
      }
    
    setCode: (code) ->
      { tokens } = await oauth2Client.getToken code
      oauth2Client.setCredentials tokens
      console.log "Store access token to '#{TOKEN_PATH}'"
      await fsx.writeJson TOKEN_PATH, tokens
    
    display: ->
      unless await fsx.exists TOKEN_PATH
        return console.log 'Token file not found.'
      
      { expiry_date } = require TOKEN_PATH

      ret = {
        'File path': TOKEN_PATH
        'Now': "#{moment()}"
        'Expiry Date': "#{moment(expiry_date)}"
        'Expiry': "#{moment(expiry_date).fromNow()}"
      }

      console.log colors.bold '________________________________________________________'
      console.log 'Token file'
      for prop, val of ret
        console.log _.padStart("#{colors.bold prop}", 25, ' ') + ": #{val}"
      console.log colors.bold '________________________________________________________'
  }

module.exports = self
