import os
import re

path = 'c:/Users/kholifah/.gemini/antigravity/scratch/rhk-agent/script.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

premium_func = """
function togglePremiumStatus(event) {
  let isPremium = event.target.checked;
  localStorage.setItem('aspend_is_premium', isPremium);
  let statusText = document.getElementById('premium-status-text');
  if(statusText) {
    statusText.textContent = isPremium ? 'Aktif (Premium)' : 'Tidak Aktif (Gratis)';
    statusText.className = isPremium ? 'text-xs text-primary font-bold' : 'text-xs text-on-surface-variant';
  }
}
"""
content += '\n' + premium_func

# Replace loadProfileSettings to handle new AI & Premium UI
new_load_settings = """function loadProfileSettings() {
  document.getElementById('input-email').value = state.user.email || '';
  document.getElementById('input-nama').value = state.user.nama || '';
  document.getElementById('input-nip').value = state.user.nip || '';
  document.getElementById('input-jabatan').value = state.user.jabatan || 'Pendamping PKH';
  document.getElementById('input-kabupaten').value = state.user.kabupaten || '';
  
  var initials = getInitials(state.user.nama || state.user.email || '');
  document.getElementById('profile-initials').textContent = initials;
  
  if (state.user.photoBase64) {
    document.getElementById('profile-photo-preview').innerHTML = `<img src="${state.user.photoBase64}" class="w-full h-full object-cover">`;
  }
  
  const signatureBase64 = localStorage.getItem('aspend_signature_base64');
  if (signatureBase64) {
    document.getElementById('signature-preview').innerHTML = `<img src="${signatureBase64}" class="max-w-full max-h-full object-contain">`;
  }
  
  // AI Settings
  let savedModel = localStorage.getItem('aspend_ai_model') || 'google/gemini-flash-1.5';
  let modelSelect = document.getElementById('select-ai-provider');
  if(modelSelect) modelSelect.value = savedModel;
  
  // Premium Status
  let isPremium = localStorage.getItem('aspend_is_premium') === 'true';
  let premToggle = document.getElementById('toggle-premium');
  if(premToggle) {
    premToggle.checked = isPremium;
    togglePremiumStatus({target: {checked: isPremium}});
  }
}"""
old_load_match = re.search(r'function loadProfileSettings\(\)\s*\{.*?\}\s*(?=function\s+saveSettings)', content, re.DOTALL)
if old_load_match:
    content = content.replace(old_load_match.group(0), new_load_settings + "\n\n")

# Replace saveAIConfigSettings
new_save_ai = """function saveAIConfigSettings() {
  let modelSelect = document.getElementById('select-ai-provider');
  if(modelSelect) {
    localStorage.setItem('aspend_ai_model', modelSelect.value);
    showToast('Pilihan model AI berhasil disimpan.', 'success');
  }
}"""
old_save_ai_match = re.search(r'function saveAIConfigSettings\(\)\s*\{.*?\}\s*(?=function\s+testAIConnectionSettings)', content, re.DOTALL)
if old_save_ai_match:
    content = content.replace(old_save_ai_match.group(0), new_save_ai + "\n\n")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Premium and AI settings logic updated.")
