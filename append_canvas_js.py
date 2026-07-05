import os

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
canvas_script = """
// ── SISTEM KANVAS TANDA TANGAN ──────────────────────────────────
let canvas, ctx, isDrawing = false;
let lastX = 0, lastY = 0;

function initSignatureCanvas() {
  canvas = document.getElementById('signature-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#000f22'; // Warna tinta (primary)
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Mouse events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  // Touch events
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);
}

function getPos(e) {
  let rect = canvas.getBoundingClientRect();
  let clientX = e.clientX;
  let clientY = e.clientY;
  
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }
  
  // Skala untuk menangani canvas di layar high DPI
  let scaleX = canvas.width / rect.width;
  let scaleY = canvas.height / rect.height;
  
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  isDrawing = true;
  let pos = getPos(e);
  [lastX, lastY] = [pos.x, pos.y];
}

function handleTouchStart(e) {
  e.preventDefault();
  startDrawing(e);
}

function draw(e) {
  if (!isDrawing) return;
  let pos = getPos(e);
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  
  [lastX, lastY] = [pos.x, pos.y];
}

function handleTouchMove(e) {
  e.preventDefault();
  draw(e);
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignatureCanvas() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function openSignatureCanvas() {
  document.getElementById('modal-canvas').classList.remove('hidden');
  if (!canvas) {
    initSignatureCanvas();
  } else {
    clearSignatureCanvas();
  }
}

function saveCanvasSignature() {
  if (!canvas) return;
  
  // Deteksi apakah canvas kosong (belum digambar)
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  if (canvas.toDataURL() === blank.toDataURL()) {
    showToast('Kanvas masih kosong! Silakan coretkan tanda tangan Anda.', 'error');
    return;
  }
  
  const dataUrl = canvas.toDataURL('image/png');
  
  // Simpan ke localStorage
  localStorage.setItem('aspend_signature_base64', dataUrl);
  
  // Tampilkan ke UI
  let previewBox = document.getElementById('signature-preview');
  if (previewBox) {
    previewBox.innerHTML = `<img src="${dataUrl}" class="max-w-full max-h-full object-contain">`;
  }
  
  closeModal('modal-canvas');
  showToast('Tanda Tangan digital berhasil disimpan!', 'success');
}
"""

with open(path, 'a', encoding='utf-8') as f:
    f.write('\n' + canvas_script)

print("Canvas JS injected.")
