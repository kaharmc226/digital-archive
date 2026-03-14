import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserPermissions, filterAllowedCategories, validateFolderAccess } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!rootId) {
      return NextResponse.json({ error: 'Root Folder ID not configured' }, { status: 500 });
    }

    const folderId = searchParams.get('folderId') || rootId;
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const date = searchParams.get('date') || '';

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
    let currentFolderName = 'Semua Dokumen';

    // Hierarchical access check if not at root
    if (folderId !== rootId) {
      const accessCheck = await validateFolderAccess(folderId, allowedFolders, rootId);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ 
          currentFolderName: 'Akses Ditolak', 
          folders: [], files: [], categories: [], 
          error: 'Anda tidak memiliki izin untuk melihat folder ini.' 
        }, { status: 403 });
      }
      currentFolderName = accessCheck.folderName || 'Folder';
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

    let q = `'${folderId}' in parents and trashed = false`;

    if (search || type || date) {
      let baseQuery = '';
      if (folderId === rootId) {
        const parentIds = [rootId, ...categories.map(c => c.id!)];
        const parentsQuery = parentIds.map(id => `'${id}' in parents`).join(' or ');
        baseQuery = `(${parentsQuery})`;
      } else {
        baseQuery = `'${folderId}' in parents`;
      }

      let conditions = [baseQuery, 'trashed = false'];

      if (search) {
        const escapedSearch = search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        conditions.push(`name contains '${escapedSearch}'`);
      }

      if (type) {
        if (type === 'document') {
          conditions.push(`(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/msword' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')`);
        } else if (type === 'spreadsheet') {
          conditions.push(`(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.ms-excel' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`);
        } else if (type === 'presentation') {
          conditions.push(`(mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/vnd.ms-powerpoint' or mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')`);
        } else if (type === 'pdf') {
          conditions.push(`mimeType = 'application/pdf'`);
        } else if (type === 'image') {
          conditions.push(`mimeType contains 'image/'`);
        } else if (type === 'video') {
          conditions.push(`mimeType contains 'video/'`);
        } else if (type === 'archive') {
          conditions.push(`(mimeType = 'application/zip' or mimeType = 'application/x-rar-compressed' or mimeType = 'application/x-tar' or mimeType = 'application/x-7z-compressed')`);
        }
      }

      if (date) {
        const now = new Date();
        let dateString = '';
        if (date === 'today') {
          now.setHours(0,0,0,0);
          dateString = now.toISOString();
        } else if (date === 'last7days') {
          now.setDate(now.getDate() - 7);
          dateString = now.toISOString();
        } else if (date === 'last30days') {
          now.setDate(now.getDate() - 30);
          dateString = now.toISOString();
        } else if (date === 'thisyear') {
          now.setMonth(0, 1);
          now.setHours(0,0,0,0);
          dateString = now.toISOString();
        }
        
        if (dateString) {
           conditions.push(`modifiedTime >= '${dateString}'`);
        }
      }

      q = conditions.join(' and ');
    }

    // 4. Fetch the actual items
    const response = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, size, createdTime)',
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
