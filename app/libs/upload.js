/* eslint-disable no-console */
// const ProgressBar = require('progress');
const Promise = require('bluebird');
const _ = require('lodash');
const cliProgress = require('cli-progress');
const colors = require('colors');
const fs = require('fs');
const humanize = require('humanize');
const mime = require('mime-types');
const path = require('path');
// const { promisify } = require('util');

const GOOGLE_MIME_FOLDER = 'application/vnd.google-apps.folder';
// const GOOGLE_MIME_FILE = 'application/vnd.google-apps.file';

module.exports = ({ drive: aDrive }) => {
  const drive = aDrive;

  const self = {
    uploadFile: async ({ fromFile, fileSize, toDrive }, idx, total) => {
      console.log('');
      console.log(`${idx + 1}/${total}) .. ${fromFile}`);
      const parentId = await self.createDirs(path.dirname(toDrive));

      // bar = new ProgressBar("[:percent] #{toDrive}", { total: fileSize })
      console.log('  Uploading file: ', path.basename(fromFile));
      const bar = new cliProgress.Bar({
        format: '  [{bar}] {percentage}%',
      }, cliProgress.Presets.react);

      bar.start(fileSize, 0);

      const { data } = await drive.files.create({
        requestBody: {
          name: path.basename(toDrive),
          originalFilename: path.basename(fromFile),
          mimeType: mime.contentType(path.extname(fromFile)),
          parents: [parentId],
        },
        media: {
          body: fs.createReadStream(fromFile),
        },
      }, {
        maxRedirects: 0,
        onUploadProgress: (evt) => {
          bar.update(evt.bytesRead);
        },
      });

      bar.stop();

      await self.deleteDupFiles(parentId, { drivePath: toDrive, fileId: data.id });
      console.log(colors.bold.green('Done. ') + data.id);

      _.extend({}, { fromFile, fileSize, toDrive }, { id: data.id });
    },
    deleteDupFiles: async (parentId, { drivePath, fileId }) => {
      const filename = path.basename(drivePath);

      const q = [
        `'${parentId}' in parents`,
        'trashed = false',
        `name = "${filename}"`,
      ].join(' and ');

      // console.log('  list file by conditions ', q);
      let res = await drive.files.list({ q });
      const files = _.get(res, 'data.files', []);

      res = await Promise.map(files, ({ id }) => {
        const p = drive.files.get({
          fileId: id,
          fields: 'id,md5Checksum,name',
        });
        return p;
      });

      const dupfiles = _(res).map(({ data }) => data)
        .groupBy(({ md5Checksum }) => md5Checksum)
        .mapValues(afiles => afiles.map(({ id }) => id))
        .value();

      let remFileIds = [];

      _(dupfiles).each((fileIds) => {
        if (fileIds.length <= 0) return false;
        if (_(fileIds).includes(fileId)) {
          remFileIds = remFileIds.concat(fileIds.filter(id => id !== fileId));
        } else {
          _(fileIds).each((id, idx) => {
            if (idx > 0) remFileIds.push(id);
          });
        }
        return true;
      });

      await Promise.mapSeries(remFileIds, async (aFileId) => {
        console.log(colors.red('  Delete: ') + aFileId);
        return drive.files.delete({ fileId: aFileId });
      });
    },
    commondir: (files) => {
      const dirs = _(files).map(e => path.dirname(e).split(path.sep).slice(1)).value();
      // const maxidx = _.min(dirs.map(e => e.length));

      const common = [];
      // for idx in [0..maxidx]
      for (let idx = 0; idx < 0; idx += 1) {
        const ret = dirs.map(e => e[idx]);
        const u = _(ret).uniq().value();
        if ((u.length === 1) && u[0]) {
          common.push(_(ret).uniq().value()[0]);
        }
      }

      return `${path.sep}${common.join(path.sep)}`;
    },
    fileStat: async (aFilePath) => {
      const ret = new Promise((resolve, reject) => {
        fs.stat(aFilePath, (err, stat) => {
          if (err) return reject(err);
          return resolve({
            path: aFilePath,
            fileSize: stat.size,
            fileSizeH: humanize.filesize(stat.size),
          });
        });
      });
      return ret;
    },
    upload: async (files) => {
      const values = await Promise.mapSeries(files, (filePath) => {
        const ret = new Promise((resolve, reject) => {
          fs.stat(filePath, (err, stat) => {
            if (err) return reject(err);
            return resolve({
              fromFile: filePath,
              fileSize: stat.size,
              fileSizeH: humanize.filesize(stat.size),
              toDrive: filePath,
            });
          });
        });
        return ret;
      });
      return Promise.mapSeries(values, self.uploadFile);
    },
    doCreateDir: async (aParentId, aDirName) => {
      let parentId = aParentId;
      if (!_.isString(parentId) || _.isEmpty(parentId)) {
        const res = await drive.files.get({ fileId: 'root' });
        parentId = _.get(res, 'data.id');
      }

      const q = [
        `'${parentId}' in parents`,
        'trashed = false',
        `name = "${aDirName}"`,
        `mimeType = '${GOOGLE_MIME_FOLDER}'`,
      ].join(' and ');

      let res = await drive.files.list({ q });
      let id = _.get(res, 'data.files[0].id');

      if (_.isString(id) && !_.isEmpty(id)) {
        console.log(`  Exists: ${aDirName} : ${id}`);
        return id;
      }

      res = await drive.files.create({
        requestBody: {
          name: aDirName,
          mimeType: GOOGLE_MIME_FOLDER,
          parents: [parentId],
        },
      });

      id = _.get(res, 'data.id');
      console.log(`  Created: ${aDirName} : ${id}`);
      return id;
    },
    createDirs: async (absPath) => {
      console.log('  Creating Directories .. ', absPath);
      const paths = _.filter(absPath.split(path.sep), (e => !_.isEmpty(e)));

      const parentIds = [];
      await Promise.mapSeries(paths, async (dirname, idx) => {
        const parentId = (idx < 1 ? null : parentIds[idx - 1]);
        const dirId = await self.doCreateDir(parentId, dirname);
        parentIds[idx] = dirId;
        return true;
      });
      return _.last(parentIds);
    },
  };
  return self;
};
