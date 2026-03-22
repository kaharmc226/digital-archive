const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function checkSheet() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientId || !clientSecret || !refreshToken || !sheetId) {
    console.error('Missing config');
    return;
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3000');
  auth.setCredentials({ refresh_token: refreshToken.replace(/"/g, '') });

  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.export({
      fileId: sheetId,
      mimeType: 'text/csv',
    }, { responseType: 'text' });
    
    console.log("== CSV DATA ==");
    console.log(response.data);
    console.log("==============");
  } catch (err) {
    console.error("API Error: ", err.message);
  }
}

checkSheet();
