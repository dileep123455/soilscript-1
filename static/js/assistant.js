(() => {
  const form = document.getElementById('chat-form');
  if (!form) return;

  const messagesNode = document.getElementById('chat-messages');
  const input = document.getElementById('chat-input');
  const languageSelect = document.getElementById('assistant-language');
  const sendButton = form.querySelector('.send-button');
  const recordButton = document.getElementById('record-voice');
  const recordStatus = document.getElementById('recording-status');
  const recordLabel = document.getElementById('recording-label');
  let history = [];
  let recorder = null;
  let chunks = [];
  const responseById = new Map();
  let nextMessageId = 0;

  const appendMessage = (role, text) => {
    const row = document.createElement('div');
    row.className = `message-row ${role === 'user' ? 'user-message' : 'assistant-message'}`;
    if (role !== 'user') {
      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = '✳';
      row.append(avatar);
    }
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const p = document.createElement('p');
    p.textContent = text;
    const stamp = document.createElement('small');
    stamp.textContent = role === 'user' ? 'You · just now' : 'Soil Script · just now';
    bubble.append(p, stamp);
    row.append(bubble);
    if (role === 'assistant') {
      const tools = document.createElement('div');
      tools.className = 'message-tools';
      const speak = document.createElement('button');
      speak.type = 'button';
      speak.textContent = '▶ Listen';
      speak.dataset.speakId = String(nextMessageId);
      responseById.set(String(nextMessageId), text);
      nextMessageId += 1;
      tools.append(speak);
      bubble.append(tools);
    }
    messagesNode.append(row);
    messagesNode.scrollTop = messagesNode.scrollHeight;
  };

  const addTyping = () => {
    const row = document.createElement('div');
    row.id = 'assistant-typing';
    row.className = 'message-row assistant-message';
    row.innerHTML = '<div class="message-avatar">✳</div><div class="message-bubble"><div class="typing-indicator" aria-label="Assistant is writing"><i></i><i></i><i></i></div></div>';
    messagesNode.append(row);
    messagesNode.scrollTop = messagesNode.scrollHeight;
  };

  const ask = async (text) => {
    const cleaned = (text || '').trim();
    if (!cleaned) return;
    input.value = '';
    input.style.height = 'auto';
    appendMessage('user', cleaned);
    history.push({ role: 'user', content: cleaned });
    history = history.slice(-8);
    sendButton.disabled = true;
    addTyping();
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: languageSelect.value, messages: history })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The assistant could not answer just now.');
      document.getElementById('assistant-typing')?.remove();
      history.push({ role: 'assistant', content: data.reply });
      history = history.slice(-8);
      appendMessage('assistant', data.reply);
    } catch (error) {
      document.getElementById('assistant-typing')?.remove();
      appendMessage('assistant', error.message || 'I could not connect just now. Please try again in a moment.');
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  });
  document.querySelectorAll('.prompt-chips button[data-prompt]').forEach((chip) => chip.addEventListener('click', () => ask(chip.dataset.prompt)));

  document.getElementById('clear-chat').addEventListener('click', () => {
    history = [];
    messagesNode.replaceChildren();
    const day = document.createElement('div');
    day.className = 'chat-day-label';
    const label = document.createElement('span');
    label.textContent = 'YOUR FARM, YOUR QUESTIONS';
    day.append(label);
    messagesNode.append(day);
    appendMessage('assistant', 'Hello! I’m here to help make farm information easier to understand. What’s on your mind today?');
  });

  messagesNode.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-speak-id]');
    if (!button) return;
    const text = responseById.get(button.dataset.speakId);
    if (!text) return;
    button.disabled = true;
    button.textContent = 'Preparing audio…';
    try {
      const response = await fetch('/api/assistant/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: languageSelect.value })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Audio is unavailable.');
      }
      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      audio.addEventListener('ended', () => { URL.revokeObjectURL(audioUrl); button.disabled = false; button.textContent = '▶ Listen'; });
      await audio.play();
      button.textContent = 'Playing…';
    } catch (error) {
      window.soilToast?.(error.message || 'Audio is unavailable.');
      button.disabled = false;
      button.textContent = '▶ Listen';
    }
  });

  const transcribeRecording = async (blob) => {
    recordLabel.textContent = 'Turning your voice into text…';
    const audioData = new FormData();
    const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    audioData.append('audio', blob, `question.${extension}`);
    audioData.append('language', languageSelect.value);
    try {
      const response = await fetch('/api/assistant/transcribe', { method: 'POST', body: audioData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Speech recognition failed.');
      if (!data.transcript) throw new Error('No speech was recognized. Try again or type your question.');
      input.value = data.transcript;
      await ask(data.transcript);
    } catch (error) {
      window.soilToast?.(error.message || 'Voice recognition is unavailable.');
    } finally {
      recordStatus.classList.add('hidden');
      recordButton.classList.remove('recording');
      recordButton.setAttribute('aria-label', 'Record a question');
    }
  };

  const stopRecording = () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  recordButton.addEventListener('click', async () => {
    if (recorder && recorder.state === 'recording') {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      window.soilToast?.('Voice recording is not supported here. Please type your question.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported?.(type));
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        transcribeRecording(blob);
      }, { once: true });
      recorder.start();
      recordButton.classList.add('recording');
      recordButton.setAttribute('aria-label', 'Stop recording');
      recordStatus.classList.remove('hidden');
      recordLabel.textContent = 'Listening… tap again to finish';
    } catch (_error) {
      window.soilToast?.('Microphone access is unavailable. Check browser permission or type your question.');
    }
  });
})();
