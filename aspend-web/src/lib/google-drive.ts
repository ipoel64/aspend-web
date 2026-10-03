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

/**
 * Mendaftar semua file di dalam folder Google Drive tertentu
 */
export async function listFilesInFolder(accessToken: string, folderId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const drive = await getDriveClient(accessToken);
  const files: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined = undefined;

  // 1. Cek izin akses folder terlebih dahulu
  try {
    await drive.files.get({
      fileId: folderId,
      fields: 'id, name',
      supportsAllDrives: true,
    });
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || '';
    if (err.status === 404 || msg.toLowerCase().includes('not found')) {
      throw new Error('Folder Google Drive tidak ditemukan (404). Pastikan ID/Link folder benar dan folder telah dibagikan.');
    }
    if (err.status === 403 || msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('permission')) {
      throw new Error('Izin akses folder ditolak (403). Akun Google saat ini belum memiliki izin melihat isi folder tersebut. Pastikan folder dibagikan langsung ke email akun ini, atau gunakan Tab 2 (Unggah ZIP).');
    }
    throw new Error(`Gagal mengakses folder Google Drive: ${msg}`);
  }

  // 2. Query file di dalam folder
  do {
    const res: any = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (res.data.files) {
      for (const f of res.data.files) {
        if (f.id && f.name) {
          files.push({ id: f.id, name: f.name, mimeType: f.mimeType || 'image/jpeg' });
        }
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Menyalin file dari satu lokasi Drive ke folder target
 */
export async function copyFileInDrive(
  accessToken: string,
  fileId: string,
  newFileName: string,
  targetFolderId?: string
) {
  const drive = await getDriveClient(accessToken);
  const requestBody: any = {
    name: newFileName,
  };
  if (targetFolderId) {
    requestBody.parents = [targetFolderId];
  }

  const res = await drive.files.copy({
    fileId: fileId,
    requestBody: requestBody,
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  if (res.data.id) {
    try {
      await drive.permissions.create({
        fileId: res.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
    } catch (err) {
      console.warn('Set permission failed on copied file:', err);
    }
  }

  return res.data;
}

/**
 * Ekstrak ID Folder dari URL Google Drive atau ID mentah
 */
export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

/**
 * Ekstrak Spreadsheet ID dari URL Google Sheets atau ID mentah
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

