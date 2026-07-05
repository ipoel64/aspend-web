import 'dart:io';

void main() {
  final dir = Directory('lib');
  if (!dir.existsSync()) {
    print('Directory lib not found.');
    return;
  }

  final files = dir.listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'));
  final output = StringBuffer();
  int matchCount = 0;

  for (final file in files) {
    final lines = file.readAsLinesSync();
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      if (RegExp(r'\bAI\b').hasMatch(line)) {
        output.writeln('${file.path}:${i + 1}: ${line.trim()}');
        matchCount++;
      }
    }
  }

  output.writeln('Total matches: $matchCount');
  
  final outFile = File('search_out.txt');
  outFile.writeAsStringSync(output.toString());
  print('Done writing output to search_out.txt. Matches: $matchCount');
}
