import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserProfile, getOrCreatePersonalFolder } from '@/lib/permissions';

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

    // 1. Check user permissions
    const userProfile = await getUserProfile(session.user.email);
    if (!userProfile.hasAccess) {
      return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
    }

    // 2. To delete a file, we need to know what folder it's in to check permissions
    const fileMeta = await drive.files.get({
       fileId: fileId,
       fields: 'parents'
    });

    if (!fileMeta.data.parents || fileMeta.data.parents.length === 0) {
      return NextResponse.json({ error: 'Cannot determine file location' }, { status: 400 });
    }

    const parentId = fileMeta.data.parents[0];

    // 3. Determine user's root constraint
    let userRootId = rootId;
    if (!userProfile.isAdmin) {
      userRootId = await getOrCreatePersonalFolder(userProfile.name, userProfile.email);
    }

    // 4. Verify ownership
    if (parentId !== userRootId) {
      if (!userProfile.isAdmin) {
        let currentId = parentId;
        let isAllowed = false;
        try {
          while (currentId && currentId !== userRootId && currentId !== rootId) {
             const parentRes = await drive.files.get({ fileId: currentId, fields: 'parents' });
             if (!parentRes.data.parents || parentRes.data.parents.length === 0) break;
             currentId = parentRes.data.parents[0];
          }
          if (currentId === userRootId) {
             isAllowed = true;
          }
        } catch (e) {
             isAllowed = false;
        }

        if (!isAllowed) {
           return NextResponse.json({ error: 'Anda tidak memiliki izin untuk menghapus file ini.' }, { status: 403 });
        }
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
