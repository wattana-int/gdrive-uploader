/* eslint-disable no-console */
const _ = require('lodash');
const { google } = require('googleapis');
const colors = require('colors');
const fsx = require('fs-extra');
const moment = require('moment');

const CLIENT_JSON_FILE = '/data/client_secret.json';
const TOKEN_PATH = '/data/token.json';
const SCOPES = [
  'https://www.googleapis.com/auth/plus.me',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const buildClient = async () => {
  const clientFileExists = await fsx.exists(CLIENT_JSON_FILE);
  if (!clientFileExists) {
    console.log(colors.bold.red(`${CLIENT_JSON_FILE} not found.`));
    process.exit(127);
  }

  const { installed } = await fsx.readJSON(CLIENT_JSON_FILE);
  const {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: redirectUris,
  } = installed;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUris[0],
  );

  const drive = google.drive({
    version: 'v3',
    auth: oauth2Client,
  });

  const tokenExists = await fsx.exists(TOKEN_PATH);
  if (tokenExists) {
    const tokenData = await fsx.readJson(TOKEN_PATH);
    // if (_(tokenData).has('refresh_token')) {
    // }
    oauth2Client.setCredentials(tokenData);
  }

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      console.log('--- token expired, renew from refresh token ---');
    }
  });

  return {
    clientId,
    clientSecret,
    oauth2Client,
    drive,
  };
};

module.exports = async () => {
  const {
    clientId, clientSecret, oauth2Client, drive,
  } = await buildClient();

  const self = {
    generateAuthUrl: () => {
      console.log(oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      }));
    },
    setCode: async (aCode) => {
      const { tokens } = await oauth2Client.getToken(aCode);
      oauth2Client.setCredentials(tokens);
      console.log(`Store access token to '${TOKEN_PATH}`);
      await fsx.writeJson(TOKEN_PATH, tokens);
      return { oauth2Client };
    },
    showAuthInfo: async () => {
      const tokenExists = await fsx.exists(TOKEN_PATH);
      if (!tokenExists) {
        return console.log(colors.bold('Token file not found!'));
      }

      const { access_token: accessToken, expiry_date: expiryDate } = await fsx.readJSON(TOKEN_PATH);

      const ret = {
        'File path': TOKEN_PATH,
        Now: moment().toString(),
        'Expiry Date': `${moment(expiryDate)}`,
        Expiry: moment(expiryDate).fromNow().toString(),
      };

      console.log(colors.bold('________________________________________________________'));
      console.log('Token file');
      Object.entries(ret).forEach(([prop, val]) => {
        const a = _.padStart(`${colors.bold.green(prop)}`, 35, ' ');
        console.log(`${a}: ${val}`);
      });

      const { data } = await drive.about.get({
        fields: 'user(displayName,emailAddress,me)',
      });
      console.log(data);
      console.log(colors.bold('________________________________________________________'));
      console.log('AccessToken:');
      console.log(accessToken);
      console.log();
    },
  };
  return _.extend(self, {
    clientId, clientSecret, drive, oauth2Client,
  });
};
