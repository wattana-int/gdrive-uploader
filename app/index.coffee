program = require 'commander'

program
  .command 'auth'
  .option '--code [code]', 'Auth code'
  .action (cmd) ->
    require("./libs/auth") cmd
    
program.parse process.argv
