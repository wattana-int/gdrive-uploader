#!/usr/bin/env coffee
colors  = require 'colors'
path    = require 'path'
program = require 'commander'
fg      = require 'fast-glob'

program
  .command 'auth'
  .option '-c, --code <code>', 'Auth code'
  .option '-g, --generate-url', 'Generate login url'
  .action (cmd) ->
    { oauth2Client,
      generateUrl,
      setCode,
      display } = await require('./libs/auth')()
    
    if cmd.generateUrl then return generateUrl()
    if cmd.code then return await setCode(cmd.code)
    display()

program
  .command 'account'
  .action ->
    { drive } = await require('./libs/auth')()
    
    { data } = await drive.about.get {
      fields: "user(displayName,emailAddress,me)"
    }
    console.log colors.bold '______________________________________________________________'
    console.log data
    console.log colors.bold '______________________________________________________________'

program
  .command 'files <file-glob>'
  .option '-u, --upload', 'Upload files'
  .option '-p, --drive-dir <driveDir>', 'Drive target dir'
  .option '-y, --confirm', 'Confirm'
  .action (fileGlob, cmd) ->
    files = await fg fileGlob
    { upload } = await require('./libs/file')()
    await upload files, cmd
    
program.parse process.argv
