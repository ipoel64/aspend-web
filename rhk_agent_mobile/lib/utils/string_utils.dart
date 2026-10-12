/// Utilitas manipulasi string
library;

/// Mengubah teks menjadi format Title Case / Capitalize Each Word
/// Contoh: "SUMATERA UTARA" -> "Sumatera Utara", "KABUPATEN LANGKAT" -> "Kabupaten Langkat"
/// Menangani tanda hubung ("BANDA-ACEH" -> "Banda-Aceh") dan garis miring ("KAB/KOTA" -> "Kab/Kota")
String formatTitleCase(String? text) {
  if (text == null || text.trim().isEmpty) return '';
  final trimmed = text.trim();
  return trimmed.split(RegExp(r'\s+')).map((word) {
    if (word.isEmpty) return '';
    if (word.contains('/')) {
      return word.split('/').map((w) => _capitalizeWord(w)).join('/');
    }
    if (word.contains('-')) {
      return word.split('-').map((w) => _capitalizeWord(w)).join('-');
    }
    return _capitalizeWord(word);
  }).join(' ');
}

String _capitalizeWord(String w) {
  if (w.isEmpty) return '';
  if (w.length == 1) return w.toUpperCase();
  return '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}';
}
