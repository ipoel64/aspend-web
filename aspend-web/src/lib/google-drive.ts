import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Mendapatkan instance Google Drive API
 */
export async function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth });
}

/**
 * Otomatis mencari Spreadsheet "Aspend Database" milik user di Google Drive
 */
export async function findAspendSpreadsheet(accessToken: string): Promise<string | null> {
  const drive = await getDriveClient(accessToken);
  
  // 1. Coba cari persis nama 'Aspend Database'
  let response = await drive.files.list({
    q: "name='Aspend Database' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id || null;
  }

  // 2. Jika tidak ada yang persis, cari yang mengandung 'Aspend'
  response = await drive.files.list({
    q: "name contains 'Aspend' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id || null;
  }

  // 3. Jika tidak ada, cari yang mengandung 'RHK'
  response = await drive.files.list({
    q: "name contains 'RHK' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id || null;
  }

  return null;
}

/**
 * Mencari atau membuat folder di Google Drive
 */
export async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string) {
  const drive = await getDriveClient(accessToken);
  
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await drive.files.list({
    q: query,
    spaces: 'drive',
    fields: 'files(id, name)',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Jika tidak ada, buat baru
  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  return folder.data.id;
}

/**
 * Upload file biner ke Google Drive
 */
export async function uploadFileToDrive(accessToken: string, fileName: string, mimeType: string, buffer: Buffer, folderId?: string) {
  const drive = await getDriveClient(accessToken);
  
  const fileMetadata: any = {
    name: fileName,
  };
  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: mimeType,
    body: Readable.from(buffer),
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink, webContentLink',
  });

  // Set permission to anyone with link (seperti di app lama)
  try {
    if (file.data.id) {
      await drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    }
  } catch (err) {
    console.error('Gagal set permission:', err);
  }

  return file.data;
}
