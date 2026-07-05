import 'package:googleapis/sheets/v4.dart' as sheets;

class SheetsService {
  final sheets.SheetsApi _api;

  SheetsService(this._api);

  sheets.SheetsApi get api => _api;

  Future<String> createSpreadsheet(String title) async {
    final spreadsheet = sheets.Spreadsheet(
      properties: sheets.SpreadsheetProperties(title: title),
    );
    final result = await _api.spreadsheets.create(spreadsheet);
    return result.spreadsheetId!;
  }

  Future<void> createSheet(String spreadsheetId, String sheetName) async {
    final request = sheets.Request(
      addSheet: sheets.AddSheetRequest(
        properties: sheets.SheetProperties(title: sheetName),
      ),
    );
    final batchRequest = sheets.BatchUpdateSpreadsheetRequest(
      requests: [request],
    );
    await _api.spreadsheets.batchUpdate(batchRequest, spreadsheetId);
  }

  Future<void> writeHeaders(
    String spreadsheetId,
    String sheetName,
    List<String> headers,
  ) async {
    final valueRange = sheets.ValueRange(values: [headers]);
    await _api.spreadsheets.values.update(
      valueRange,
      spreadsheetId,
      '$sheetName!A1',
      valueInputOption: 'USER_ENTERED',
    );
  }

  Future<List<List<Object?>>> getAllRows(
    String spreadsheetId,
    String sheetName,
  ) async {
    final response = await _api.spreadsheets.values.get(
      spreadsheetId,
      sheetName,
    );
    final values = response.values;
    if (values == null || values.isEmpty) {
      return [];
    }
    // Skip header row
    if (values.length > 1) {
      return values.sublist(1);
    }
    return [];
  }

  Future<void> appendRow(
    String spreadsheetId,
    String sheetName,
    List<Object?> row,
  ) async {
    final valueRange = sheets.ValueRange(values: [row]);
    await _api.spreadsheets.values.append(
      valueRange,
      spreadsheetId,
      sheetName,
      valueInputOption: 'USER_ENTERED',
    );
  }

  Future<void> updateRow(
    String spreadsheetId,
    String sheetName,
    int rowIndex,
    List<Object?> row,
  ) async {
    final valueRange = sheets.ValueRange(values: [row]);
    await _api.spreadsheets.values.update(
      valueRange,
      spreadsheetId,
      '$sheetName!A$rowIndex',
      valueInputOption: 'USER_ENTERED',
    );
  }

  Future<void> deleteRow(
    String spreadsheetId,
    String sheetName,
    int rowIndex,
  ) async {
    // Get sheet ID to delete row
    final spreadsheet = await _api.spreadsheets.get(spreadsheetId);
    final sheet = spreadsheet.sheets?.firstWhere(
      (s) => s.properties?.title == sheetName,
    );
    if (sheet == null || sheet.properties?.sheetId == null) return;

    final request = sheets.Request(
      deleteDimension: sheets.DeleteDimensionRequest(
        range: sheets.DimensionRange(
          sheetId: sheet.properties!.sheetId,
          dimension: 'ROWS',
          startIndex: rowIndex - 1, // 0-indexed
          endIndex: rowIndex,
        ),
      ),
    );

    final batchRequest = sheets.BatchUpdateSpreadsheetRequest(
      requests: [request],
    );
    await _api.spreadsheets.batchUpdate(batchRequest, spreadsheetId);
  }

  Future<int> findRowByValue(
    String spreadsheetId,
    String sheetName,
    int colIndex,
    String value,
  ) async {
    final response = await _api.spreadsheets.values.get(
      spreadsheetId,
      sheetName,
    );
    final values = response.values;
    if (values == null) return -1;

    for (int i = 0; i < values.length; i++) {
      if (values[i].length > colIndex &&
          values[i][colIndex].toString() == value) {
        return i + 1; // 1-indexed for sheets
      }
    }
    return -1;
  }

  Future<List<Object?>?> getRowByValue(
    String spreadsheetId,
    String sheetName,
    int colIndex,
    String value,
  ) async {
    final response = await _api.spreadsheets.values.get(
      spreadsheetId,
      sheetName,
    );
    final values = response.values;
    if (values == null) return null;

    for (final row in values) {
      if (row.length > colIndex && row[colIndex].toString() == value) {
        return row.cast<Object?>();
      }
    }
    return null;
  }

  Future<void> writeCell(
    String spreadsheetId,
    String sheetName,
    String cell,
    String value,
  ) async {
    final valueRange = sheets.ValueRange(
      values: [
        [value],
      ],
    );
    await _api.spreadsheets.values.update(
      valueRange,
      spreadsheetId,
      '$sheetName!$cell',
      valueInputOption: 'USER_ENTERED',
    );
  }
}
