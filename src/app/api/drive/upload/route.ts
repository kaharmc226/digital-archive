import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { Readable } from 'stream';
import { auth } from '@/auth';
import { getUserPermissions, validateFolderAccess } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const targetFolderId = (formData.get('folderId') as string) || rootId;

    if (!file || !targetFolderId || !rootId) {
      return NextResponse.json({ error: 'Missing file or folder configuration' }, { status: 400 });
    }

    // Check permissions
    const allowedFolders = await getUserPermissions(session.user.email);
    if (allowedFolders.length === 0) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    if (targetFolderId !== rootId) {
       const accessCheck = await validateFolderAccess(targetFolderId, allowedFolders, rootId);
       if (!accessCheck.hasAccess) {
         return NextResponse.json({ error: 'Anda tidak memiliki izin untuk mengunggah ke folder ini.' }, { status: 403 });
       }
    } else {
       // Uploading to root. Is it allowed?
       if (!allowedFolders.includes('*')) {
          // If not admin, they can't upload to root, only to their specific category folders
          return NextResponse.json({ error: 'Anda tidak memiliki izin untuk mengunggah ke direktori utama.' }, { status: 403 });
       }
    }

    const drive = await getDriveService();
    
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
