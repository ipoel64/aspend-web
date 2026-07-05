import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
ad_script = """
// ── SISTEM IKLAN (AdMob Mock) ──────────────────────────────────
function showAdModal(onCloseCallback) {
  document.getElementById('modal-ad').classList.remove('hidden');
  
  let timerSpan = document.getElementById('ad-timer');
  let btnClose = document.getElementById('btn-close-ad');
  
  let timeLeft = 3;
  if(timerSpan) timerSpan.textContent = timeLeft;
  if(btnClose) {
    btnClose.disabled = true;
    btnClose.innerHTML = '<span class="material-symbols-outlined text-[18px]">hourglass_empty</span> Tunggu <span id="ad-timer">' + timeLeft + '</span> detik...';
  }
  
  let interval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      let tSpan = document.getElementById('ad-timer');
      if(tSpan) tSpan.textContent = timeLeft;
    } else {
      clearInterval(interval);
      let btn = document.getElementById('btn-close-ad');
      if(btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">close</span> Tutup Iklan & Lanjutkan';
        
        btn.onclick = function() {
          document.getElementById('modal-ad').classList.add('hidden');
          if (typeof onCloseCallback === 'function') {
            onCloseCallback();
          }
        };
      }
    }
  }, 1000);
}
"""

with open(path, 'a', encoding='utf-8') as f:
    f.write('\n' + ad_script)

print("Ad logic appended to script.js")
