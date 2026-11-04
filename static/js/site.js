(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const primaryNav = document.querySelector('.primary-nav');
  if (menuButton && primaryNav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      primaryNav.classList.toggle('open', open);
    });
  }

  const moreButton = document.querySelector('.nav-more');
  const moreWrap = document.querySelector('.nav-more-wrap');
  if (moreButton && moreWrap) {
    moreButton.addEventListener('click', () => {
      const open = moreButton.getAttribute('aria-expanded') !== 'true';
      moreButton.setAttribute('aria-expanded', String(open));
      moreWrap.classList.toggle('open', open);
    });
  }

  const toast = document.getElementById('site-toast');
  let toastTimer;
  window.soilToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3600);
  };

  const cropForm = document.getElementById('crop-form');
  if (cropForm) {
    const results = document.getElementById('crop-results');
    const intro = document.getElementById('crop-results-intro');
    const options = {
      kharif: {
        clay: [['Pearl millet or sorghum', 'Often considered in monsoon planning; check local rainfall, seed, and variety guidance.'], ['Pigeon pea', 'A pulse option to discuss for the local sowing window and soil drainage.'], ['Groundnut', 'Consider only where local conditions and water management are suitable.']],
        loam: [['Maize', 'A common monsoon crop in many areas; check local variety and planting dates.'], ['Pigeon pea', 'A pulse crop to explore with a local crop calendar.'], ['Groundnut', 'A possible option where drainage and local growing conditions fit.']],
        sandy: [['Pearl millet', 'A hardy cereal often discussed for drier areas; confirm local varieties.'], ['Green gram', 'A short-duration pulse option to check against the local calendar.'], ['Sorghum', 'A cereal option to compare where suitable seed is available.']],
        unknown: [['Pearl millet or sorghum', 'Ask whether these fit local rainfall and your field conditions.'], ['Green gram', 'A pulse option to compare with the local crop calendar.'], ['Pigeon pea', 'Ask about suitable varieties, sowing window, and drainage.']]
      },
      rabi: {
        clay: [['Chickpea', 'A pulse option to discuss where winter conditions and drainage are suitable.'], ['Safflower', 'Ask a local expert whether the variety and rainfall pattern fit your field.'], ['Wheat', 'Consider only where the local calendar and water supply support it.']],
        loam: [['Chickpea', 'A common winter pulse option; check local sowing and variety guidance.'], ['Mustard', 'A possible oilseed option to compare for your area.'], ['Wheat', 'Check water needs, planting window, and local variety advice.']],
        sandy: [['Mustard', 'Ask whether local varieties suit your soil and water access.'], ['Chickpea', 'Confirm drainage and the local planting window.'], ['Barley', 'A cereal option to ask about where it is locally grown.']],
        unknown: [['Chickpea', 'Ask if it suits your soil, winter temperatures, and local calendar.'], ['Mustard', 'Compare local varieties and expected water needs.'], ['Wheat', 'Check reliable irrigation and local crop guidance first.']]
      },
      zaid: {
        clay: [['Green gram', 'A short-duration crop to ask about if the soil and water supply fit.'], ['Fodder crops', 'Compare local forage options and their water requirements.'], ['Cucurbits', 'Ask about a suitable local crop and safe water management.']],
        loam: [['Green gram', 'A short-duration pulse option; confirm the local summer calendar.'], ['Cucurbits', 'Consider only with suitable water, seed, and market access.'], ['Fodder crops', 'Ask about local varieties and irrigation requirements.']],
        sandy: [['Watermelon or muskmelon', 'Explore only where local conditions, water, and markets support them.'], ['Green gram', 'Check whether a short-duration variety fits the local window.'], ['Fodder crops', 'Compare water needs and local demand before sowing.']],
        unknown: [['Green gram', 'A short-duration option to discuss with a local agriculture officer.'], ['Cucurbits', 'Ask about water needs, local seed, and market access.'], ['Fodder crops', 'Compare locally suitable varieties and water requirements.']]
      }
    };
    const waterNotes = {
      rainfed: 'Rainfed field: confirm expected rainfall and sowing advice for your block before selecting a crop.',
      limited: 'Some irrigation: match the crop to the water you can count on through the full growing period.',
      assured: 'Reliable irrigation: confirm water quality, timing, and total seasonal needs with local guidance.'
    };
    const priorityNotes = {
      food: 'For household food, consider what your family uses and how you store it safely.',
      market: 'For a market crop, check nearby buyer demand, transport, likely costs, and price uncertainty.',
      soil: 'For soil cover or rotation, ask which locally suitable crop can follow your previous crop.'
    };
    cropForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(cropForm);
      const season = formData.get('season');
      const soil = formData.get('soil');
      const water = formData.get('water');
      const priority = formData.get('priority');
      const picks = options[season]?.[soil] || options.kharif.unknown;
      results.replaceChildren();
      picks.forEach(([name, note], index) => {
        const card = document.createElement('article');
        card.className = 'crop-result-card';
        const number = document.createElement('span');
        number.className = 'crop-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const content = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = name;
        const text = document.createElement('p');
        text.textContent = note;
        content.append(title, text);
        const mark = document.createElement('span');
        mark.textContent = '✳';
        card.append(number, content, mark);
        results.append(card);
      });
      const note = document.createElement('div');
      note.className = 'planner-disclaimer';
      const mark = document.createElement('span');
      mark.textContent = 'i';
      const text = document.createElement('p');
      text.textContent = `${waterNotes[water]} ${priorityNotes[priority]}`;
      note.append(mark, text);
      results.append(note);
      intro.textContent = 'These are broad options to discuss with your local agriculture office or KVK—not a prediction or guarantee.';
      results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  const guideChecks = [...document.querySelectorAll('[data-guide-step]')];
  if (guideChecks.length) {
    const key = 'soil-script-guide-v1';
    const count = document.getElementById('guide-progress-number');
    const bar = document.getElementById('guide-progress-bar');
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_error) { saved = {}; }
    const update = () => {
      const completed = guideChecks.filter((item) => item.checked).length;
      if (count) count.textContent = String(completed);
      if (bar) bar.style.width = `${(completed / guideChecks.length) * 100}%`;
      try { localStorage.setItem(key, JSON.stringify(Object.fromEntries(guideChecks.map((item) => [item.dataset.guideStep, item.checked])))); } catch (_error) { /* local storage is optional */ }
    };
    guideChecks.forEach((item) => {
      item.checked = Boolean(saved[item.dataset.guideStep]);
      item.addEventListener('change', update);
    });
    update();
    document.getElementById('reset-guide')?.addEventListener('click', () => {
      guideChecks.forEach((item) => { item.checked = false; });
      update();
      window.soilToast?.('Your checklist has been reset.');
    });
  }

  const healthForm = document.getElementById('health-form');
  if (healthForm) {
    const output = document.getElementById('observation-content');
    const guidance = {
      spots: ['Mark how many leaves and plants are affected.', 'Photograph both sides of a leaf and the whole plant.', 'Note whether spots are spreading after rain or irrigation.'],
      yellow: ['Note whether older or newer leaves changed first.', 'Check if the pattern follows wet, dry, or low-lying parts of the field.', 'Take photos and ask about a soil or nutrient check before applying anything.'],
      wilting: ['Check soil moisture near the affected and healthy plants.', 'Note whether wilting is limited to one row, patch, or time of day.', 'Avoid extra irrigation or treatment until a local expert checks the cause.'],
      holes: ['Look for insects or feeding signs without touching unknown organisms.', 'Photograph the damage and the whole plant.', 'Check whether new leaves or older leaves are affected.'],
      stunted: ['Compare affected plants with healthy plants of the same age.', 'Note planting date, seed source, water, and recent field work.', 'Ask whether a local soil or root check would help.'],
      fruit: ['Photograph the affected part and an unaffected example.', 'Note when the damage began and whether it is spreading.', 'Keep a sample only if a local expert asks and gives safe handling instructions.']
    };
    healthForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const symptom = document.getElementById('symptom-type').value;
      const spread = document.getElementById('symptom-spread').value;
      const timing = document.getElementById('symptom-timing').value;
      output.replaceChildren();
      const icon = document.createElement('div');
      icon.className = 'observation-icon';
      icon.textContent = '⌕';
      const title = document.createElement('h3');
      title.textContent = 'Write down what you see.';
      const p = document.createElement('p');
      const spreadText = { few: 'a few plants', patch: 'a patch of the field', many: 'many parts of the field', unsure: 'an area you are still checking' }[spread];
      const timingText = { today: 'today or yesterday', week: 'within the last week', longer: 'more than a week ago', unsure: 'an uncertain time' }[timing];
      p.textContent = `You noticed a change on ${spreadText}, beginning ${timingText}. This observation does not identify the cause.`;
      const list = document.createElement('ul');
      guidance[symptom].forEach((item) => { const li = document.createElement('li'); li.textContent = item; list.append(li); });
      const reminder = document.createElement('p');
      reminder.className = 'health-reminder';
      reminder.textContent = 'Show these notes to your local agriculture officer or KVK before deciding on treatment.';
      output.append(icon, title, p, list, reminder);
      output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  const filterButtons = [...document.querySelectorAll('.filter-chip[data-filter]')];
  const equipmentCards = [...document.querySelectorAll('.equipment-card[data-task]')];
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    filterButtons.forEach((item) => item.classList.toggle('active', item === button));
    const filter = button.dataset.filter;
    equipmentCards.forEach((card) => {
      const tasks = card.dataset.task.split(' ');
      card.hidden = filter !== 'all' && !tasks.includes(filter);
    });
  }));
})();
