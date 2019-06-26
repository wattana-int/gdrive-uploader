#!/usr/local/bin/node
/* eslint-disable no-console */
const _ = require('lodash');
const colors = require('colors');
const fg = require('fast-glob');
const path = require('path');
const program = require('commander');
const prompts = require('prompts');
const Promise = require('bluebird');

const authFunction = require('./libs/auth');
const uploadFunction = require('./libs/upload');

program
  .command('link <id>')
  .action(async (id) => {
    let fileId = id;
    const { oauth2Client } = await authFunction();

    const test = id.match(/^.*id=(\S*)$/);
    if (test) {
      if (test[1]) [, fileId] = test;
    }

    const { token } = await oauth2Client.getAccessToken();
    const baseUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${token}`;
    console.log('---');
    console.log(baseUrl);
    console.log('');
  });

program
  .command('auth')
  .option('--info', 'Show Info')
  .action(async ({ info }) => {
    const { generateAuthUrl, setCode, showAuthInfo } = await authFunction();
    if (info) {
      await showAuthInfo();
      return process.exit(0);
    }
    console.log('');
    console.log(generateAuthUrl());
    const { code } = await prompts({
      type: 'text',
      name: 'code',
      message: 'Put Code Here: ',
    });

    const { oauth2Client } = await setCode(code);
    return oauth2Client;
  });

program
  .command('upload [glob]')
  .action(async (aGlob) => {
    const { drive } = await authFunction();

    let glob = path.join(process.cwd(), '**/*');
    if (aGlob) glob = path.join(process.cwd(), aGlob);

    console.log(colors.green(`GLOB: ${glob}`));

    const files = await fg(glob);

    if (_(files).isEmpty() || !_(files).isArray()) {
      console.log(colors.bold.yellow('Found 0 files'));
      process.exit(127);
    }

    console.log(colors.bold('------- files -------'));
    const { upload, fileStat } = uploadFunction({ drive });
    await Promise.mapSeries(files, async (f, idx) => {
      const { fileSizeH } = await fileStat(f);
      let sizeTxt = _.padStart(colors.green(`${fileSizeH}`), 23, ' ');
      sizeTxt = colors.green(`[${sizeTxt}]`);
      console.log(` ${idx + 1}/${files.length}) ${sizeTxt} ${f}`);
      return Promise.resolve();
    });

    console.log('');

    const ans = await prompts({
      type: 'toggle',
      name: 'value',
      message: `Confirm? upload ${files.length} files`,
      initial: false,
      active: 'Yes',
      inactive: 'No',
    });

    if (!ans.value) {
      console.log(colors.bold('- bye -'));
      process.exit(1);
    }

    await upload(files);
  });

program.parse(process.argv);
