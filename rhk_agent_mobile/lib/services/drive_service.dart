import 'dart:typed_data';
import 'package:googleapis/drive/v3.dart' as drive;

class DriveService {
  final drive.DriveApi _api;

  DriveService(this._api);

  Future<String> createFolder(String name) async {
    final folder = drive.File(
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
    );
    final result = await _api.files.create(folder);
    return result.id!;
  }

  Future<String?> findFolder(String name) async {
    final escapedName = name.replaceAll("'", "\\'");
    final query =
        "name = '$escapedName' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    final response = await _api.files.list(q: query, spaces: 'drive');
    if (response.files != null && response.files!.isNotEmpty) {
      return response.files!.first.id;
    }
    return null;
  }

  Future<String?> findSpreadsheetByTitle(String title) async {
    final escapedTitle = title.replaceAll("'", "\\'");
    final query =
        "name = '$escapedTitle' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
    final response = await _api.files.list(q: query, spaces: 'drive');
    if (response.files != null && response.files!.isNotEmpty) {
      return response.files!.first.id;
    }
    return null;
  }

  Future<String> getOrCreateFolder(String name) async {
    final folderId = await findFolder(name);
    if (folderId != null) {
      return folderId;
    }
    return await createFolder(name);
  }

  Future<String> uploadFile(
    String folderId,
    String fileName,
    List<int> bytes,
    String mimeType,
  ) async {
    final file = drive.File(name: fileName, parents: [folderId]);
    final media = drive.Media(Stream.value(bytes), bytes.length);
    final result = await _api.files.create(
      file,
      uploadMedia: media,
      $fields: 'id',
    );
    return result.id!;
  }

  Future<void> deleteFile(String fileId) async {
    await _api.files.delete(fileId);
  }

  Future<Uint8List?> downloadFile(String fileId) async {
    try {
      final drive.Media media =
          await _api.files.get(
                fileId,
                downloadOptions: drive.DownloadOptions.fullMedia,
              )
              as drive.Media;
      final chunks = <List<int>>[];
      int totalLength = 0;
      await for (final chunk in media.stream) {
        chunks.add(chunk);
        totalLength += chunk.length;
      }
      final bytes = Uint8List(totalLength);
      int offset = 0;
      for (final chunk in chunks) {
        bytes.setRange(offset, offset + chunk.length, chunk);
        offset += chunk.length;
      }
      return bytes;
    } catch (e) {
      print('Error downloading file: $e');
      return null;
    }
  }

  String getThumbnailUrl(String fileId, {int size = 150}) {
    return 'https://drive.google.com/thumbnail?id=$fileId&sz=w$size';
  }

  String getViewUrl(String fileId) {
    return 'https://drive.google.com/file/d/$fileId/view';
  }

  Future<void> setPublicAccess(String fileId) async {
    try {
      final permission = drive.Permission(type: 'anyone', role: 'reader');
      await _api.permissions.create(permission, fileId);
    } catch (e) {
      print('Warning: Failed to set public access for file $fileId: $e');
    }
  }

  Future<void> shareWithAdmin(String fileId, String adminEmail) async {
    try {
      final permission = drive.Permission(
        type: 'user',
        role: 'writer',
        emailAddress: adminEmail,
      );
      // sendNotificationEmail: false prevents spamming the admin inbox
      await _api.permissions.create(
        permission,
        fileId,
        sendNotificationEmail: false,
      );
    } catch (e) {
      print('Warning: Failed to share file $fileId with admin $adminEmail: $e');
    }
  }

  Future<List<drive.File>> listCsvFiles() async {
    try {
      final response = await _api.files.list(
        q: "trashed = false",
        orderBy: "modifiedTime desc",
        pageSize: 200,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        $fields: 'files(id, name, mimeType, size, createdTime)',
      );
      final allFiles = response.files ?? [];
      final csvFiles = allFiles.where((f) {
        final name = f.name?.toLowerCase() ?? '';
        final mime = f.mimeType?.toLowerCase() ?? '';
        return name.endsWith('.csv') ||
               mime == 'text/csv' ||
               mime == 'text/comma-separated-values' ||
               mime == 'application/csv' ||
               mime == 'application/vnd.ms-excel' ||
               mime == 'text/plain';
      }).toList();
      return csvFiles;
    } catch (e) {
      print('Error listing CSV files: $e');
      return [];
    }
  }
}
