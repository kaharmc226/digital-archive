import { getDriveService } from './googleDrive';
import { Session } from 'next-auth';

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

export async function getUserPermissions(email: string | null | undefined): Promise<string[]> {
  if (!email) return []; // No email, no access
  
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    // If no spreadsheet is configured, we fallback to allowing all access (or you could change this to deny all)
    // For now, let's allow all to prevent breaking the app if they haven't set it up yet.
    return ['*'];
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
    for (let i = 1; i < lines.length; i++) { // Skip header row
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCsvLine(line);
      if (columns.length < 2) continue;
      
      const rowEmail = columns[0].trim().toLowerCase();
      const rowFolders = columns[1].trim();
      
      if (rowEmail === email.toLowerCase()) {
        if (rowFolders === '*' || rowFolders === '') {
          return ['*']; // Full access
        }
        // Split by comma and clean up whitespace
        return rowFolders.split(',').map(f => f.trim().toLowerCase()).filter(f => f);
      }
    }
    
    // If user not found in the list, they have no access
    return [];
  } catch (error) {
    console.error('Error fetching permissions from sheet:', error);
    return []; // Deny access on error
  }
}

export function filterAllowedCategories(categories: any[], allowedFolders: string[]) {
  if (allowedFolders.includes('*')) return categories;
  return categories.filter(cat => allowedFolders.includes(cat.name?.toLowerCase() || ''));
}

export async function validateFolderAccess(folderId: string, allowedFolders: string[], rootId: string): Promise<{hasAccess: boolean, folderName?: string}> {
  if (allowedFolders.includes('*')) return { hasAccess: true };

  try {
    const drive = await getDriveService();
    let currentId = folderId;
    let folderName = '';

    // Trace up the hierarchy
    while (currentId && currentId !== rootId) {
      const response = await drive.files.get({
        fileId: currentId,
        fields: 'id, name, parents',
      });
      
      const fileData = response.data;
      if (!folderName) {
         folderName = fileData.name || 'Folder'; // Save the immediate requested folder name
      }

      // Check if this folder's name is in the allowed list
      if (fileData.name && allowedFolders.includes(fileData.name.toLowerCase())) {
        return { hasAccess: true, folderName };
      }

      // Move up to the parent
      if (fileData.parents && fileData.parents.length > 0) {
        currentId = fileData.parents[0];
      } else {
        break; // Reached the top of drive (not rootId)
      }
    }

    return { hasAccess: false, folderName };
  } catch (error) {
    console.error('Error validating folder access:', error);
    return { hasAccess: false };
  }
}
