import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_theme.dart';
import '../providers/auth_provider.dart';
import 'dashboard/dashboard_screen.dart';
import 'report/create_report_screen.dart';
import 'settings/settings_screen.dart';
import 'pengaduan/pengaduan_list_screen.dart';
import 'nota_dinas/nota_dinas_list_screen.dart';
import 'verkom/verkom_tools_screen.dart';

/// Home Screen — Bottom Navigation Hub
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      debugPrint('HomeScreen: App resumed, refreshing session...');
      context.read<AuthProvider>().refreshSession();
    }
  }

  final List<Widget> _screens = const [
    DashboardScreen(),       // 0: RHK (Dashboard)
    PengaduanListScreen(),   // 1: Pengaduan
    VerkomToolsScreen(),     // 2: VERKOM
    NotaDinasListScreen(),   // 3: Nota Dinas
    SettingsScreen(),        // 4: Pengaturan (Fallback when profile is incomplete)
  ];

  void _showIncompleteProfileDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
            SizedBox(width: 8),
            Text('Profil Belum Lengkap', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: const Text(
          'Anda harus melengkapi profil, mengunggah tanda tangan, mengisi API Key Asisten Pendamping, dan sukses melakukan Tes Koneksi di halaman Pengaturan sebelum dapat membuat laporan.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.navy,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        final isComplete = auth.isProfileComplete;
        final activeIndex = isComplete ? _currentIndex : 4;

        return Scaffold(
          body: IndexedStack(index: activeIndex, children: _screens),
          
          // Floating Action Button for Quick Access
          floatingActionButton: FloatingActionButton(
            onPressed: () {
              if (!isComplete) {
                _showIncompleteProfileDialog(context);
              } else {
                // Push CreateReportScreen as a new page for quick access
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const CreateReportScreen()),
                );
              }
            },
            backgroundColor: AppColors.navy,
            foregroundColor: AppColors.bgLight,
            elevation: 8,
            shape: const CircleBorder(),
            child: const Icon(Icons.add, size: 32),
          ),
          floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,

          bottomNavigationBar: BottomAppBar(
            color: AppColors.surface,
            shape: const CircularNotchedRectangle(),
            notchMargin: 8.0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  icon: Icons.assignment_outlined,
                  label: 'RHK',
                  index: 0,
                  isEnabled: isComplete,
                  activeIndex: activeIndex,
                ),
                _buildNavItem(
                  icon: Icons.assignment_late_outlined,
                  label: 'Pengaduan',
                  index: 1,
                  isEnabled: isComplete,
                  activeIndex: activeIndex,
                ),
                const SizedBox(width: 36), // Space for FAB
                _buildNavItem(
                  icon: Icons.build_circle_rounded,
                  label: 'VERKOM',
                  index: 2,
                  isEnabled: isComplete,
                  activeIndex: activeIndex,
                ),
                _buildNavItem(
                  icon: Icons.description_outlined,
                  label: 'Nota Dinas',
                  index: 3,
                  isEnabled: isComplete,
                  activeIndex: activeIndex,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required int index,
    required bool isEnabled,
    required int activeIndex,
  }) {
    final isSelected = activeIndex == index;
    final color = isSelected 
        ? AppColors.navy 
        : (isEnabled ? AppColors.textSecondary : AppColors.textSecondary.withOpacity(0.3));
    
    return InkWell(
      onTap: () {
        if (!isEnabled) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Silakan lengkapi profil & lakukan Tes Koneksi di halaman Pengaturan terlebih dahulu.'),
              backgroundColor: Colors.orange,
              behavior: SnackBarBehavior.floating,
            ),
          );
          return;
        }
        setState(() => _currentIndex = index);
      },
      borderRadius: BorderRadius.circular(50),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
