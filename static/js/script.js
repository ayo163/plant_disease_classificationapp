(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fileInput = $('leafImage');
  const zone = $('uploadZone');
  const result = $('resultContent');
  const status = $('statusTag');
  const analyzeBtn = $('analyzeBtn');
  const maxSize = 10 * 1024 * 1024;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  let previewUrl = null;

  function setStatus(message) { status.textContent = message; }
  function showMessage(message, state = 'Notice') { result.textContent = message; setStatus(state); }
  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    fileInput.value = '';
    $('imagePreview').classList.add('d-none');
    $('emptyPreview').classList.remove('d-none');
    $('previewImage').removeAttribute('src');
  }
  function showPreview(file) {
    if (!file) return;
    if (!allowedTypes.includes(file.type)) { clearPreview(); showMessage('Please upload a JPG, PNG or WEBP image.', 'Invalid file'); return; }
    if (file.size > maxSize) { clearPreview(); showMessage('The image must be 10 MB or smaller.', 'File too large'); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    $('previewImage').src = previewUrl;
    $('fileName').textContent = file.name;
    $('emptyPreview').classList.add('d-none');
    $('imagePreview').classList.remove('d-none');
    showMessage('Image selected. Click Analyze Crop Disease to begin.', 'Ready');
  }
  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => showPreview(fileInput.files[0]));
  ['dragenter','dragover'].forEach(type => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(type => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer(); transfer.items.add(file);
    fileInput.files = transfer.files;
    showPreview(file);
  });
  $('clearBtn').addEventListener('click', () => { clearPreview(); showMessage('Your analysis will appear here after you upload a leaf image.', 'Awaiting image'); });
  $('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    if (!file || !allowedTypes.includes(file.type) || file.size > maxSize) { showMessage('Please select a valid JPG, PNG or WEBP image under 10 MB.', 'Invalid image'); return; }
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Analyzing...';
    showMessage('Analyzing your crop leaf. Please wait...', 'Analyzing');
    const data = new FormData(); data.append('image', file);
    const csrfToken = document.cookie.split('; ').find(x => x.startsWith('csrftoken='))?.split('=')[1];
    try {
      const response = await fetch('/api/analyze/', { method: 'POST', body: data, headers: csrfToken ? { 'X-CSRFToken': decodeURIComponent(csrfToken) } : {} });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Analysis failed. Please try again.');
      const analysis = payload.analysis ?? payload.result;
      if (typeof analysis !== 'string' || !analysis.trim()) throw new Error('The server returned no analysis.');
      // Render as text rather than HTML to prevent script injection from model output.
      showMessage(analysis, 'Complete');
    } catch (error) { showMessage(error.message || 'Could not connect to the analysis server.', 'Error'); }
    finally { analyzeBtn.disabled = false; analyzeBtn.innerHTML = '<i class="bi bi-stars"></i> Analyze Crop Disease'; }
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === button));
    $('welcome').classList.toggle('d-none', button.dataset.view === 'upload');
    $('sidebar').classList.remove('open');
    if (button.dataset.view === 'upload') $('leafImage').focus();
  }));
  $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  $('logoutBtn').addEventListener('click', () => {
    // Replace this placeholder with a Django logout POST endpoint.
    alert('Connect this button to your Django logout endpoint.');
  });
})();

