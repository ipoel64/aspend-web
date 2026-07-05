import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'

alarm_script = """
// ── SISTEM ALARM & NOTIFIKASI PUSAT ────────────────────────────
function initAlarmSystem() {
  // Minta izin notifikasi jika belum
  if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  // Cek setiap menit
  setInterval(() => {
    let now = new Date();
    let day = now.getDay(); // 0 = Minggu, 1 = Senin, dst
    let hour = now.getHours();
    let minute = now.getMinutes();
    
    // Hanya hari kerja (Senin-Jumat) pukul 17:00
    if (day >= 1 && day <= 5 && hour === 17 && minute === 0) {
      // Cek apakah hari ini sudah buat laporan
      let todayStr = now.toISOString().split('T')[0];
      let alreadyReported = false;
      
      if (state.reports) {
        alreadyReported = state.reports.some(r => r.Tanggal === todayStr);
      }
      
      if (!alreadyReported) {
        let lastNotif = localStorage.getItem('aspend_last_notif_date');
        if (lastNotif !== todayStr) {
          localStorage.setItem('aspend_last_notif_date', todayStr);
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Waktunya Buat RHK!", {
              body: "Jangan lupa buat RHK hari ini ya... Buka ASPEND sekarang.",
              icon: "https://cdn-icons-png.flaticon.com/512/3233/3233483.png" // Ikon asisten default
            });
          } else {
            // Fallback: Tampilkan toast
            showToast('Waktunya buat RHK! Jangan lupa isi laporan hari ini ya...', 'info');
          }
        }
      }
    }
  }, 60000); // 60 ribu ms = 1 menit
}

// Inisialisasi saat aplikasi dimuat
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initAlarmSystem, 5000);
});
"""

with open(path, 'a', encoding='utf-8') as f:
    f.write('\n' + alarm_script)

print("Alarm logic injected.")
