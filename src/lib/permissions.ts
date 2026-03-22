import { getDriveService } from './googleDrive';
import { Session } from 'next-auth';

export interface UserProfile {
  hasAccess: boolean;
  isAdmin: boolean;
  name: string;
  email: string;
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

export async function getUserProfile(email: string | null | undefined): Promise<UserProfile> {
  if (!email) return { hasAccess: false, isAdmin: false, name: '', email: '' };
  
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    return { hasAccess: true, isAdmin: true, name: 'Admin (No Sheet)', email };
  }

  try {
    const drive = await getDriveService();
    
    // Export the spreadsheet as CSV
    const response = await drive.files.export({
      fileId: sheetId,
      mimeType: 'text/csv',
    }, { responseType: 'text' });
    
    const csvText = response.data as string;
    
    // Parse the CSV
    const lines = csvText.split('\n');
    if (lines.length < 2) return { hasAccess: false, isAdmin: false, name: '', email };

    // Dynamically find column indices based on headers
    const headers = parseCsvLine(lines[0].trim()).map(h => h.toLowerCase().replace(/"/g, ''));
    let emailIdx = headers.findIndex(h => h.includes('email') || h === 'alamat email');
    let foldersIdx = headers.findIndex(h => h.includes('akses folder') || h.includes('permissions') || h.includes('folder'));
    let nameIdx = headers.findIndex(h => h.includes('nama lengkap') || h.includes('nama') || h.includes('name'));

    // Fallbacks if header names don't match exactly
    if (emailIdx === -1) emailIdx = 1; 
    if (foldersIdx === -1) foldersIdx = headers.length > 2 ? headers.length - 1 : 2; 
    if (nameIdx === -1) nameIdx = 0; // Assume name is in column A if not explicit

    for (let i = 1; i < lines.length; i++) { // Skip header row
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCsvLine(line);
      if (columns.length <= Math.max(emailIdx, foldersIdx) && columns.length < 2) continue;
      
      const rowEmail = (columns[emailIdx] || '').trim().toLowerCase();
      const rowFolders = (columns[foldersIdx] || '').trim();
      const rowName = (columns[nameIdx] || 'Siswa').trim();
      
      if (rowEmail === email.toLowerCase()) {
        const isAdmin = rowFolders.includes('*') || rowFolders.toLowerCase().includes('admin');
        return {
          hasAccess: true,
          isAdmin,
          name: rowName,
          email: rowEmail
        };
      }
    }
    
    // If user not found in the list, they have no access
    return { hasAccess: false, isAdmin: false, name: '', email };
  } catch (error) {
    console.error('Error fetching permissions from sheet:', error);
    return { hasAccess: false, isAdmin: false, name: '', email }; // Deny access on error
  }
}

export async function getOrCreatePersonalFolder(userName: string, userEmail: string): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID environment variable.");

  const drive = await getDriveService();
  const folderName = `${userName} - ${userEmail}`;

  try {
    // 1. Search if folder already exists in the master root
    const query = `'${rootId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    const searchRes = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      return searchRes.data.files[0].id!;
    }

    // 2. If not found, instantly create a new personal folder
    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootId]
      },
      fields: 'id'
    });

    return createRes.data.id!;
  } catch (err: any) {
    console.error("Error creating personal folder:", err);
    throw new Error("Failed to create personal vault.");
  }
}
