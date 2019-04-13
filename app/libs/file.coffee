ProgressBar   = require 'progress'
Promise       = require 'bluebird'
_             = require 'lodash'
colors        = require 'colors'
fs            = require 'fs'
humanize      = require 'humanize'
mime          = require 'mime-types'
path          = require 'path'
{ promisify } = require 'util'

statAsync  = promisify(fs.stat)

GOOGLE_MIME_FOLDER  = 'application/vnd.google-apps.folder'
GOOGLE_MIME_FILE    = 'application/vnd.google-apps.file'

module.exports = ->
  { drive } = await require('./auth')()
  self = {
    uploadFile: ({ fromFile, fileSize, toDrive }) ->
      console.log "Uploading .. #{fromFile}"
      parentId = await self.createDirs path.dirname toDrive
      
      bar = new ProgressBar("  [:percent] #{toDrive}", { total: fileSize })
      
      res = await drive.files.create {
        requestBody: {
          name: path.basename(toDrive)
          originalFilename: path.basename(fromFile)
          mimeType: mime.contentType(path.extname(fromFile))
          parents: [ parentId ]
        }
        media: {
          body: fs.createReadStream(fromFile)
        }
      }, {
        maxRedirects: 0
        onUploadProgress: (evt) ->
          #console.log evt.bytesRead
          bar.tick evt.bytesRead if bar
      }

      fromFile
      
    commondir: (files) ->
      dirs = _(files).map(
        (e) -> path.dirname(e).split(path.sep).slice(1)
      ).value()
      maxidx = _.min dirs.map (e) -> e.length
      console.log 'max-> ', maxidx
      common = []
      for idx in [0..maxidx]
        ret = dirs.map (e) -> e[idx]
        u = _(ret).uniq().value()
        if u.length == 1 and u[0]
          common.push _(ret).uniq().value()[0]
      
      console.log '-> ', common
      "#{path.sep}#{common.join path.sep}"
      
    upload: (files, { driveDir, confirm }) ->
      cdir = self.commondir(files)
      values = await Promise.mapSeries files, (filePath) ->
        newPath = filePath
        if _.isString(driveDir)
          newDriveDir = if driveDir.endsWith "/"
                          driveDir.slice(0, -1)
                        else
                          driveDir
          
          newPath = filePath.replace cdir, newDriveDir

        new Promise (resolve, reject) ->
          fs.stat filePath, (err, stat) ->
            return reject err if err

            resolve {
              fromFile: filePath
              fileSize: stat.size
              fileSizeH: humanize.filesize stat.size
              toDrive: newPath
            }
        
      width = _.max files.map (e) -> "#{e}".length
      fileSizeWidth = _.max values.map ({ fileSizeH }) -> fileSizeH.length
      values.map ({ fromFile, fileSizeH, toDrive }) ->
        size  = _.padStart fileSizeH, fileSizeWidth, ' '
        fromF = _.padEnd fromFile, width, ' '
        to    = colors.bold '=>'
        console.log "[#{size}] #{fromF} #{to} #{toDrive}"

      await Promise.mapSeries values, self.uploadFile
      
    calMd5Hash: (filepath) ->
      new Promise (resolve, reject) ->
        md5File filepath, (err, hash) ->
          if err then return reject(err)
          resolve hash

    doCreateDir: (aParentId, aDirName) ->
      parentId = aParentId
      if !_.isString(parentId) or _.isEmpty(parentId)
        res = await drive.files.get { fileId: 'root' }
        parentId = _.get res, 'data.id'

      q = [
        "'#{parentId}' in parents"
        "trashed = false"
        "name = \"#{aDirName}\""
        "mimeType = '#{GOOGLE_MIME_FOLDER}'"
      ].join ' and '
      
      res = await drive.files.list { q }
      id = _.get res, 'data.files[0].id'
      
      if _.isString(id) and !_.isEmpty(id)
        console.log "  Exists: #{aDirName} : #{id}"
        return id

      res = await drive.files.create {
        requestBody: {
          name: aDirName
          mimeType: GOOGLE_MIME_FOLDER
          parents: [parentId]
        }
      }

      id = _.get res, 'data.id'
      console.log "  Created: #{aDirName} : #{id}"
      id

    createDirs: (absPath) ->
      console.log 'Creating Directories .. ', absPath
      paths = _.filter absPath.split(path.sep), (e) ->
        !_.isEmpty e

      parentIds = []
      await Promise.mapSeries paths, (dirname, idx, total) ->
        parentId = (if idx < 1 then null else parentIds[idx - 1])
        dirId = await self.doCreateDir parentId, dirname
        parentIds[idx] = dirId
        
      _.last parentIds
  }
