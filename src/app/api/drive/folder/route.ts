import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserProfile, getOrCreatePersonalFolder } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, parentId } = await request.json();
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!name || !rootId) {
      return NextResponse.json({ error: 'Missing name or configuration' }, { status: 400 });
    }

    const userProfile = await getUserProfile(session.user.email);
    if (!userProfile.hasAccess) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const drive = await getDriveService();

    // 1. Determine user's root constraint
    let userRootId = rootId;
    if (!userProfile.isAdmin) {
      userRootId = await getOrCreatePersonalFolder(userProfile.name, userProfile.email);
    }

    // 2. Resolve target parent. Default to userRootId
    let targetParentId = parentId;
    if (!parentId || parentId === rootId) {
      targetParentId = userRootId;
    }

    // 3. Security Check if creating in a subfolder
    if (targetParentId !== userRootId) {
      if (!userProfile.isAdmin) {
        let currentId = targetParentId;
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
           return NextResponse.json({ error: 'Anda tidak memiliki izin untuk membuat folder di lokasi ini.' }, { status: 403 });
        }
      }
    }

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
