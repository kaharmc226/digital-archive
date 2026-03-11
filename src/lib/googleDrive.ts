import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

export async function getDriveService() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  // Ensure these are configured
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth configuration in environment variables.');
  }

  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000' // Ensure this is acceptable if oob is not required by default, actually redirect URI is largely ignored for refreshing
  );

  auth.setCredentials({
    refresh_token: refreshToken.replace(/"/g, ''), // Handle if user copied quotes
  });

  return google.drive({ version: 'v3', auth });
}
