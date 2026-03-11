import { google } from 'googleapis';
import * as readline from 'readline';
import { loadEnvConfig } from '@next/env';

// Load environment variables from .env.local
loadEnvConfig('./');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
    process.exit(1);
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // Out-of-band redirect URI for local CLI scripts
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  console.log('----------------------------------------------------');
  console.log('Authorize this app by visiting this url:');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('----------------------------------------------------');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the code from that page here: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      console.log('');
      console.log('✅ Success! Add the following line to your .env.local file:');
      console.log('');
      console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
      console.log('');
    } catch (err: any) {
      console.error('Error retrieving access token', err.message);
    }
  });
}

getAccessToken();
