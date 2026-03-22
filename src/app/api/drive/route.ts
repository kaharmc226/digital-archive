import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserProfile, getOrCreatePersonalFolder } from '@/lib/permissions';

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

    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const date = searchParams.get('date') || '';

    // 1. Check user profile and permissions
    const userProfile = await getUserProfile(session.user.email);
    if (!userProfile.hasAccess) {
      return NextResponse.json({ 
        currentFolderName: 'Akses Ditolak', 
        folders: [], files: [], categories: [], 
        error: 'Anda tidak memiliki izin untuk melihat arsip ini. Silakan hubungi administrator.' 
      }, { status: 403 });
    }

    const drive = await getDriveService();

    // 2. Determine the user's root constraint
    let userRootId = rootId;
    if (!userProfile.isAdmin) {
      userRootId = await getOrCreatePersonalFolder(userProfile.name, userProfile.email);
    }

    // 3. Resolve the requested folder ID
    let resolvedFolderId = searchParams.get('folderId') || userRootId;
    
    // Default naming
    let currentFolderName = userProfile.isAdmin ? 'Semua Dokumen' : 'Folder Pribadi';

    // 4. Security Check & Name Resolution if not at their userRootId
    if (resolvedFolderId !== userRootId) {
      try {
        const folderRes = await drive.files.get({ fileId: resolvedFolderId, fields: 'name, parents' });
        currentFolderName = folderRes.data.name || 'Folder';
        
        // If not admin, verify that the requested folder is actually inside their personal vault
        if (!userProfile.isAdmin) {
          let currentId = resolvedFolderId;
          let isAllowed = false;
          // Traverse up to securely check ownership
          while (currentId && currentId !== userRootId && currentId !== rootId) {
             const parentRes = await drive.files.get({ fileId: currentId, fields: 'parents' });
             if (!parentRes.data.parents || parentRes.data.parents.length === 0) break;
             currentId = parentRes.data.parents[0];
          }
          if (currentId === userRootId) {
             isAllowed = true;
          }
          
          if (!isAllowed) {
             return NextResponse.json({ 
                currentFolderName: 'Akses Ditolak', folders: [], files: [], categories: [], 
                error: 'Anda tidak memiliki izin untuk melihat folder ini.' 
             }, { status: 403 });
          }
        }
      } catch (e) {
        return NextResponse.json({ error: 'Folder tidak ditemukan atau akses ditolak' }, { status: 404 });
      }
    }

    // 5. Fetch categories (Only for Admins)
    let categories: any[] = [];
    if (userProfile.isAdmin) {
      const rootResponse = await drive.files.list({
        q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        orderBy: 'name',
      });
      categories = rootResponse.data.files || [];
    }

    // 6. Construct Drive Query
    let q = `'${resolvedFolderId}' in parents and trashed = false`;

    if (search || type || date) {
      let baseQuery = `'${resolvedFolderId}' in parents`;
      
      // If admin is searching at root, include sub-categories in the scan
      if (userProfile.isAdmin && resolvedFolderId === rootId) {
        const parentIds = [rootId, ...categories.map(c => c.id!)];
        const parentsQuery = parentIds.map(id => `'${id}' in parents`).join(' or ');
        baseQuery = `(${parentsQuery})`;
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

    // 7. Execute Query
    const response = await drive.files.list({
      q: q,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, size, createdTime)',
      orderBy: 'folder, name',
    });

    const items = response.data.files || [];
    let folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Remove personal folders from Admin's root view so it doesn't clutter their standard categories?
    // Actually, admins should be able to see personal folders. But we can keep them visible.
    
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
