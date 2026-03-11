import { getDriveService } from './googleDrive';
import { Session } from 'next-auth';

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
      
      // Basic CSV split, assuming no complex quotes in simple email/folder list
      // A better way is using a regex to handle basic quotes if needed, but for our simple case splitting by comma is often enough for the first column.
      // Let's do a simple parse:
      const firstCommaIdx = line.indexOf(',');
      if (firstCommaIdx === -1) continue;
      
      const rowEmail = line.substring(0, firstCommaIdx).replace(/(^"|"$)/g, '').trim().toLowerCase();
      let rowFolders = line.substring(firstCommaIdx + 1).replace(/(^"|"$)/g, '').trim();
      
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
