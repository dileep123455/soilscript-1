(() => {
  const form = document.getElementById('document-form');
  if (!form) return;

  const fileInput = document.getElementById('document-file');
  const dropZone = document.getElementById('drop-zone');
  const fileName = document.getElementById('file-name');
  const button = document.getElementById('document-submit');
  const buttonLabel = button.querySelector('.button-label');
  const empty = document.getElementById('result-empty');
  const content = document.getElementById('result-content');
  const loading = document.getElementById('document-loading');
  const errorBox = document.getElementById('document-error');
  const summary = document.getElementById('summary-text');
  const original = document.getElementById('original-text');
  const targetLanguage = document.getElementById('target-language');
  const resultLanguage = document.getElementById('result-language');
  const readButton = document.getElementById('read-summary');
  let activeAudioUrl = null;

  const langShort = { 'kn-IN': 'kn', 'hi-IN': 'hi', 'ta-IN': 'ta', 'te-IN': 'te', 'ml-IN': 'ml', 'mr-IN': 'mr', 'bn-IN': 'bn', 'gu-IN': 'gu', 'pa-IN': 'pa', 'od-IN': 'or', 'en-IN': 'en' };

  const setFile = (file) => {
    if (!file) return;
    const allowed = /\.(pdf|png|jpe?g|webp)$/i.test(file.name);
    if (!allowed) {
      window.soilToast?.('Choose a PDF, PNG, JPG, JPEG, or WEBP file.');
      fileInput.value = '';
      return;
    }
    fileName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  };

  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
  }));
  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try { fileInput.files = event.dataTransfer.files; } catch (_error) { /* name preview remains available */ }
    setFile(file);
  });

  targetLanguage.addEventListener('change', () => {
    const label = targetLanguage.options[targetLanguage.selectedIndex].text;
    resultLanguage.textContent = label;
  });

  const pollDocumentJob = async (jobId, language) => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      const query = new URLSearchParams({ target_language: language });
      const response = await fetch(`/api/document/jobs/${encodeURIComponent(jobId)}?${query.toString()}`);
      const data = await response.json();
      if (response.status === 202 && data.status === 'processing') continue;
      if (!response.ok) throw new Error(data.error || 'We could not read that document. Please try again.');
      return data;
    }
    throw new Error('This document is taking longer than expected. Your upload has been submitted; try again in a moment.');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pasted = document.getElementById('source-text').value.trim();
    if (!fileInput.files.length && !pasted) {
      window.soilToast?.('Upload a document or paste in some text first.');
      return;
    }
    errorBox.classList.add('hidden');
    content.classList.add('hidden');
    empty.classList.add('hidden');
    loading.classList.remove('hidden');
    button.disabled = true;
    buttonLabel.textContent = 'Reading your document…';
    const formData = new FormData(form);
    try {
      const response = await fetch('/api/document/translate', { method: 'POST', body: formData });
      let data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not read that document. Please try again.');
      if (response.status === 202 && data.job_id) {
        buttonLabel.textContent = 'Reading the document…';
        data = await pollDocumentJob(data.job_id, data.language);
      }
      summary.textContent = data.summary;
      summary.lang = langShort[data.language] || 'en';
      original.textContent = data.original_text;
      resultLanguage.textContent = targetLanguage.options[targetLanguage.selectedIndex].text;
      loading.classList.add('hidden');
      content.classList.remove('hidden');
    } catch (error) {
      loading.classList.add('hidden');
      errorBox.textContent = error.message || 'Something went wrong. Please try again.';
      errorBox.classList.remove('hidden');
    } finally {
      button.disabled = false;
      buttonLabel.textContent = 'Make it easier to understand';
    }
  });

  readButton.addEventListener('click', async () => {
    if (!summary.textContent.trim()) return;
    readButton.disabled = true;
    readButton.innerHTML = '<span>…</span> Preparing audio';
    try {
      const response = await fetch('/api/assistant/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: summary.textContent, language: targetLanguage.value })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Audio could not be created.');
      }
      if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
      activeAudioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(activeAudioUrl);
      readButton.innerHTML = '<span>▶</span> Listen to summary';
      audio.addEventListener('ended', () => { readButton.disabled = false; });
      await audio.play();
    } catch (error) {
      window.soilToast?.(error.message || 'Audio could not be created.');
      readButton.disabled = false;
      readButton.innerHTML = '<span>▶</span> Listen to summary';
    }
  });

  document.getElementById('copy-summary').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary.textContent);
      window.soilToast?.('Summary copied.');
    } catch (_error) {
      window.soilToast?.('Copy is unavailable in this browser. You can select the summary text.');
    }
  });
})();
