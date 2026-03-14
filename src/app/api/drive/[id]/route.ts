import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserPermissions, validateFolderAccess } from '@/lib/permissions';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const drive = await getDriveService();
    const fileId = (await params).id;
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!fileId || !rootId) {
      return NextResponse.json({ error: 'Missing file ID or configuration' }, { status: 400 });
    }

    // Check user permissions
    const allowedFolders = await getUserPermissions(session.user.email);
    if (allowedFolders.length === 0) {
      return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
    }

    // To delete a file, we need to know what folder it's in to check permissions
    const fileMeta = await drive.files.get({
       fileId: fileId,
       fields: 'parents'
    });

    if (!fileMeta.data.parents || fileMeta.data.parents.length === 0) {
      return NextResponse.json({ error: 'Cannot determine file location' }, { status: 400 });
    }

    const parentId = fileMeta.data.parents[0];

    // Is the file in root?
    if (parentId === rootId) {
       if (!allowedFolders.includes('*')) {
          return NextResponse.json({ error: 'Anda tidak memiliki izin untuk menghapus file di direktori utama.' }, { status: 403 });
       }
    } else {
       // It's in a subfolder, check hierarchical access
       const accessCheck = await validateFolderAccess(parentId, allowedFolders, rootId);
       if (!accessCheck.hasAccess) {
         return NextResponse.json({ error: 'Anda tidak memiliki izin untuk menghapus file di folder ini.' }, { status: 403 });
       }
    }

    await drive.files.delete({
      fileId: fileId,
    });

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
