import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { Readable } from 'stream';
import { auth } from '@/auth';
import { getUserProfile, getOrCreatePersonalFolder } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!file || !rootId) {
      return NextResponse.json({ error: 'Missing file or configuration' }, { status: 400 });
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

    // 2. Resolve target folder. If they submitted rootId but aren't admin, force to userRootId
    let requestedFolderId = formData.get('folderId') as string;
    let targetFolderId = requestedFolderId;
    
    if (!requestedFolderId || requestedFolderId === rootId) {
       targetFolderId = userRootId;
    }

    // 3. Security check if uploading to a subfolder
    if (targetFolderId !== userRootId) {
      if (!userProfile.isAdmin) {
        let currentId = targetFolderId;
        let isAllowed = false;
        // Verify ownership
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
           return NextResponse.json({ error: 'Anda tidak memiliki izin untuk mengunggah ke folder ini.' }, { status: 403 });
        }
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [targetFolderId],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
