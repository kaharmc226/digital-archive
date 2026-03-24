"use server"

import { revalidatePath } from 'next/cache';
import { Readable } from 'stream';
import { getDriveService } from '@/lib/googleDrive';
import { auth } from '@/auth';
import { getUserProfile, getOrCreatePersonalFolder } from '@/lib/permissions';

export async function createFolderAction(name: string, parentId: string | null) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { error: 'Unauthorized' };
    }

    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!name || !rootId) {
      return { error: 'Missing name or configuration' };
    }

    const userProfile = await getUserProfile(session.user.email);
    if (!userProfile.hasAccess) {
      return { error: 'Akses ditolak' };
    }

    const drive = await getDriveService();

    let userRootId = rootId;
    if (!userProfile.isAdmin) {
      userRootId = await getOrCreatePersonalFolder(userProfile.name, userProfile.email);
    }

    let targetParentId = parentId;
    if (!parentId || parentId === rootId) {
      targetParentId = userRootId;
    }

    if (targetParentId !== userRootId && !userProfile.isAdmin) {
      let currentId: string | null | undefined = targetParentId;
      let isAllowed = false;
      try {
        while (currentId && currentId !== userRootId && currentId !== rootId) {
            const parentRes: any = await drive.files.get({ fileId: currentId, fields: 'parents' });
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
          return { error: 'Anda tidak memiliki izin untuk membuat folder di lokasi ini.' };
      }
    }

    const response = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [targetParentId as string],
      },
      fields: 'id, name',
    });

    // Notify Next.js server to invalidate the API cache for the root drive route
    revalidatePath('/'); 
    
    return { success: true, folder: response.data };
  } catch (error: any) {
    console.error('Create Folder Action Error:', error);
    return { error: error.message || 'Gagal membuat folder' };
  }
}

export async function uploadFileAction(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.email) return { error: 'Unauthorized' };

    const file = formData.get('file') as File;
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!file || !rootId) return { error: 'Missing file or configuration' };

    const userProfile = await getUserProfile(session.user.email);
    if (!userProfile.hasAccess) return { error: 'Akses ditolak' };

    const drive = await getDriveService();

    let userRootId = rootId;
    if (!userProfile.isAdmin) {
      userRootId = await getOrCreatePersonalFolder(userProfile.name, userProfile.email);
    }

    let requestedFolderId = formData.get('folderId') as string;
    let targetFolderId = requestedFolderId;
    
    if (!requestedFolderId || requestedFolderId === rootId) {
       targetFolderId = userRootId;
    }

    if (targetFolderId !== userRootId && !userProfile.isAdmin) {
      let currentId: string | null | undefined = targetFolderId;
      let isAllowed = false;
      try {
        while (currentId && currentId !== userRootId && currentId !== rootId) {
           const parentRes: any = await drive.files.get({ fileId: currentId, fields: 'parents' });
           if (!parentRes.data.parents || parentRes.data.parents.length === 0) break;
           currentId = parentRes.data.parents[0];
        }
        if (currentId === userRootId) isAllowed = true;
      } catch (e) {
        isAllowed = false;
      }
      if (!isAllowed) return { error: 'Anda tidak memiliki izin untuk mengunggah ke folder ini.' };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response: any = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [targetFolderId as string],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id, name, webViewLink',
    });

    revalidatePath('/');
    return { success: true, file: response.data };
  } catch (error: any) {
    console.error('Upload Action Error:', error);
    return { error: error.message || 'Upload failed' };
  }
}

export async function deleteFileAction(fileId: string) {
  try {
    const session = await auth();
    if (!session?.user?.email) return { error: 'Unauthorized' };

    const drive = await getDriveService();
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!fileId || !rootId) return { error: 'Missing file ID or configuration' };

    const userProfile = await getUserProfile(session.user.email);
    if (!userProfile.hasAccess) return { error: 'Akses Ditolak' };

    const fileMeta = await drive.files.get({
       fileId: fileId,
       fields: 'parents'
    });

    if (!fileMeta.data.parents || fileMeta.data.parents.length === 0) {
      return { error: 'Cannot determine file location' };
    }

    const parentId = fileMeta.data.parents[0];

    let userRootId = rootId;
    if (!userProfile.isAdmin) {
      userRootId = await getOrCreatePersonalFolder(userProfile.name, userProfile.email);
    }

    if (parentId !== userRootId && !userProfile.isAdmin) {
      let currentId: string | null | undefined = parentId;
      let isAllowed = false;
      try {
        while (currentId && currentId !== userRootId && currentId !== rootId) {
           const parentRes: any = await drive.files.get({ fileId: currentId, fields: 'parents' });
           if (!parentRes.data.parents || parentRes.data.parents.length === 0) break;
           currentId = parentRes.data.parents[0];
        }
        if (currentId === userRootId) isAllowed = true;
      } catch (e) {
        isAllowed = false;
      }

      if (!isAllowed) return { error: 'Anda tidak memiliki izin untuk menghapus file ini.' };
    }

    await drive.files.delete({ fileId: fileId });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Delete Action Error:', error);
    return { error: error.message || 'Delete failed' };
  }
}
