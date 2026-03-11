import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/googleDrive';
import { Readable } from 'stream';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    // Get the folderId from formData, default to the root archive folder if not provided
    const targetFolderId = (formData.get('folderId') as string) || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!file || !targetFolderId) {
      return NextResponse.json({ error: 'Missing file or folder configuration' }, { status: 400 });
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
