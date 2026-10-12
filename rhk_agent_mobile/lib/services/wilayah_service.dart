import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/string_utils.dart';

class WilayahItem {
  final String id;
  final String name;

  WilayahItem({required this.id, required this.name});

  factory WilayahItem.fromJson(Map<String, dynamic> json) {
    return WilayahItem(
      id: json['id']?.toString() ?? '',
      name: formatTitleCase(json['name']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'name': name};
}

class WilayahService {
  static final WilayahService instance = WilayahService._();
  WilayahService._();

  static const String _baseUrl = 'https://emsifa.github.io/api-wilayah-indonesia/api';

  final Map<String, List<WilayahItem>> _cache = {};

  // Default fallback provinces
  static final List<WilayahItem> _fallbackProvinces = [
    WilayahItem(id: '11', name: 'Aceh'),
    WilayahItem(id: '12', name: 'Sumatera Utara'),
    WilayahItem(id: '13', name: 'Sumatera Barat'),
    WilayahItem(id: '14', name: 'Riau'),
    WilayahItem(id: '15', name: 'Jambi'),
    WilayahItem(id: '16', name: 'Sumatera Selatan'),
    WilayahItem(id: '17', name: 'Bengkulu'),
    WilayahItem(id: '18', name: 'Lampung'),
    WilayahItem(id: '31', name: 'DKI Jakarta'),
    WilayahItem(id: '32', name: 'Jawa Barat'),
    WilayahItem(id: '33', name: 'Jawa Tengah'),
    WilayahItem(id: '34', name: 'DI Yogyakarta'),
    WilayahItem(id: '35', name: 'Jawa Timur'),
    WilayahItem(id: '36', name: 'Banten'),
    WilayahItem(id: '51', name: 'Bali'),
    WilayahItem(id: '52', name: 'Nusa Tenggara Barat'),
    WilayahItem(id: '53', name: 'Nusa Tenggara Timur'),
    WilayahItem(id: '61', name: 'Kalimantan Barat'),
    WilayahItem(id: '62', name: 'Kalimantan Tengah'),
    WilayahItem(id: '63', name: 'Kalimantan Selatan'),
    WilayahItem(id: '64', name: 'Kalimantan Timur'),
    WilayahItem(id: '71', name: 'Sulawesi Utara'),
    WilayahItem(id: '73', name: 'Sulawesi Selatan'),
  ];

  Future<List<WilayahItem>> getProvinces() async {
    if (_cache.containsKey('provinces')) return _cache['provinces']!;

    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedJson = prefs.getString('cached_provinces');
      if (cachedJson != null) {
        final List list = jsonDecode(cachedJson);
        final items = list.map((e) => WilayahItem.fromJson(e)).toList();
        _cache['provinces'] = items;
        return items;
      }

      final res = await http.get(Uri.parse('$_baseUrl/provinces.json')).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        final items = list.map((e) => WilayahItem.fromJson(e)).toList();
        _cache['provinces'] = items;
        await prefs.setString('cached_provinces', res.body);
        return items;
      }
    } catch (_) {}

    _cache['provinces'] = _fallbackProvinces;
    return _fallbackProvinces;
  }

  Future<List<WilayahItem>> getRegencies(String provinceId) async {
    final key = 'regencies_$provinceId';
    if (_cache.containsKey(key)) return _cache[key]!;

    try {
      final res = await http.get(Uri.parse('$_baseUrl/regencies/$provinceId.json')).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        final items = list.map((e) => WilayahItem.fromJson(e)).toList();
        _cache[key] = items;
        return items;
      }
    } catch (_) {}

    return [];
  }

  Future<List<WilayahItem>> getDistricts(String regencyId) async {
    final key = 'districts_$regencyId';
    if (_cache.containsKey(key)) return _cache[key]!;

    try {
      final res = await http.get(Uri.parse('$_baseUrl/districts/$regencyId.json')).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        final items = list.map((e) => WilayahItem.fromJson(e)).toList();
        _cache[key] = items;
        return items;
      }
    } catch (_) {}

    return [];
  }

  Future<List<WilayahItem>> getVillages(String districtId) async {
    final key = 'villages_$districtId';
    if (_cache.containsKey(key)) return _cache[key]!;

    try {
      final res = await http.get(Uri.parse('$_baseUrl/villages/$districtId.json')).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final List list = jsonDecode(res.body);
        final items = list.map((e) => WilayahItem.fromJson(e)).toList();
        _cache[key] = items;
        return items;
      }
    } catch (_) {}

    return [];
  }
}
