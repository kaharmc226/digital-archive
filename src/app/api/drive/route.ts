import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserPermissions, filterAllowedCategories } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const folderId = searchParams.get('folderId') || rootId;
    const search = searchParams.get('search') || '';
    
    if (!rootId) {
      return NextResponse.json({ error: 'Root Folder ID not configured' }, { status: 500 });
    }

    // Check user permissions
    const allowedFolders = await getUserPermissions(session.user.email);
    if (allowedFolders.length === 0) {
      return NextResponse.json({ 
        currentFolderName: 'Akses Ditolak', 
        folders: [], files: [], categories: [], 
        error: 'Anda tidak memiliki izin untuk melihat arsip ini. Silakan hubungi administrator.' 
      }, { status: 403 });
    }

    const drive = await getDriveService();

    // 1. Fetch current folder details (for breadcrumbs)
    let currentFolderName = 'Semua Dokumen';
    if (folderId !== rootId) {
      const folderMetadata = await drive.files.get({
        fileId: folderId,
        fields: 'name',
      });
      currentFolderName = folderMetadata.data.name || 'Folder';
    }

    // 2. Always fetch top-level folders (for the persistent category bar)
    const rootResponse = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      orderBy: 'name',
    });
    let categories = rootResponse.data.files || [];
    
    // Filter categories based on user permissions
    categories = filterAllowedCategories(categories, allowedFolders);

    // If the user tries to access a folder they shouldn't, deny it
    if (folderId !== rootId) {
      // Very basic security check: is the folder they are trying to access in their allowed list?
      // (This assumes they are trying to access a top level folder. For deep folders, a more complex check is needed, 
      // but this works for our category-level permissions).
      if (!allowedFolders.includes('*') && !allowedFolders.includes(currentFolderName.toLowerCase())) {
         return NextResponse.json({ 
          currentFolderName: 'Akses Ditolak', 
          folders: [], files: [], categories: categories, 
          error: 'Anda tidak memiliki izin untuk melihat folder ini.' 
        }, { status: 403 });
      }
    }

    // 3. Build search query for the items in the current folder
    let q = `'${folderId}' in parents and trashed = false`;

    if (search) {
      const escapedSearch = search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      if (folderId === rootId) {
        // Search in root and all ALLOWED top-level categories
        const parentIds = [rootId, ...categories.map(c => c.id!)];
        const parentsQuery = parentIds.map(id => `'${id}' in parents`).join(' or ');
        q = `(${parentsQuery}) and name contains '${escapedSearch}' and trashed = false`;
      } else {
        // Search only in the current folder
        q = `'${folderId}' in parents and name contains '${escapedSearch}' and trashed = false`;
      }
    }

    // 4. Fetch the actual items
    const response = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, size, createdTime)',
      orderBy: 'folder, name',
    });

    const items = response.data.files || [];
    let folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Filter root-level folders if we are at the root
    if (folderId === rootId) {
      folders = filterAllowedCategories(folders, allowedFolders);
    }

    return NextResponse.json({ 
      currentFolderName,
      folders, 
      files,
      categories
    });
  } catch (error: any) {
    console.error('Drive API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch contents' }, { status: 500 });
  }
}
