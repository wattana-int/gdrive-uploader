program = require 'commander'

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
    
program.parse process.argv
