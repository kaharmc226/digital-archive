import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserPermissions, validateFolderAccess } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, parentId } = await request.json();
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const targetParentId = parentId || rootId;

    if (!name || !targetParentId || !rootId) {
      return NextResponse.json({ error: 'Missing name or parent folder' }, { status: 400 });
    }

    // Check permissions
    const allowedFolders = await getUserPermissions(session.user.email);
    if (allowedFolders.length === 0) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // Security: Only allow creating folders within allowed categories
    if (targetParentId !== rootId) {
       const accessCheck = await validateFolderAccess(targetParentId, allowedFolders, rootId);
       if (!accessCheck.hasAccess) {
         return NextResponse.json({ error: 'Anda tidak memiliki izin untuk membuat folder di lokasi ini.' }, { status: 403 });
       }
    } else {
       // Root level creation: only for admins (*)
       if (!allowedFolders.includes('*')) {
          return NextResponse.json({ error: 'Hanya administrator yang dapat membuat kategori utama baru.' }, { status: 403 });
       }
    }

    const drive = await getDriveService();
    
    const response = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [targetParentId],
      },
      fields: 'id, name',
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Create Folder Error:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat folder' }, { status: 500 });
  }
}
