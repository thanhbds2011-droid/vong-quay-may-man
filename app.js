'use strict';

// Vòng quay may mắn · Trung tâm Bảo trợ xã hội Tân Hiệp · v1.0
// All game data stays in this browser. No Firebase, accounts, third-party scripts or analytics.
const STORAGE_KEY = 'tanhiep-water-wheel-v1';
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;
const MAX_HISTORY = 10;
const SPIN_MS = 5000;
const FINAL_REVEAL_MS = 3200;
const SEGMENT_COLORS = ['#ffd062', '#55b8f1', '#ff8aac', '#58d3a5', '#ad8bfa', '#ffad69', '#6ccbd2', '#f493d6', '#9bda6f', '#8c9fff'];
const $ = id => document.getElementById(id);
const formatNumber = number => String(number).padStart(2, '0');
const clone = value => JSON.parse(JSON.stringify(value));
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function initialState() {
  return {
    v: 1,
    phase: 'setup',
    draftNames: Array.from({ length: 5 }, () => ''),
    players: [],
    currentIndex: 0,
    rotation: 0,
    pending: null,
    sound: true,
    history: [],
    roundId: null
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || saved.v !== 1 || !Array.isArray(saved.draftNames) || !Array.isArray(saved.players)) return initialState();
    const clean = { ...initialState(), ...saved };
    clean.draftNames = saved.draftNames.slice(0, MAX_PLAYERS).map(value => String(value ?? '').slice(0, 50));
    if (clean.draftNames.length < MIN_PLAYERS) clean.draftNames = Array.from({ length: 5 }, () => '');
    clean.history = Array.isArray(saved.history) ? saved.history.slice(0, MAX_HISTORY) : [];
    clean.sound = saved.sound !== false;
    if (!['setup', 'ready', 'spinning', 'revealed', 'complete'].includes(clean.phase)) clean.phase = 'setup';
    if (!Array.isArray(clean.players) || clean.players.length < MIN_PLAYERS || clean.players.length > MAX_PLAYERS) clean.phase = 'setup';
    if (!Number.isFinite(clean.rotation)) clean.rotation = 0;
    if (!Number.isInteger(clean.currentIndex) || clean.currentIndex < 0 || clean.currentIndex > clean.players.length) clean.phase = 'setup';
    // A result is chosen and persisted before the animation begins. If the browser reloads
    // mid-spin, commit that same result exactly once; never reroll or lose the number.
    if (clean.phase === 'spinning') {
      const p = clean.pending;
      const player = clean.players[clean.currentIndex];
      const valid = p && player && Number.isInteger(p.number) &&
        p.number >= 1 && p.number <= clean.players.length &&
        Number.isFinite(p.targetRotation) &&
        !clean.players.some((item, index) => index !== clean.currentIndex && item.number === p.number) &&
        (player.number == null || player.number === p.number);
      if (valid) {
        player.number = p.number;
        clean.rotation = p.targetRotation;
        clean.pending = null;
        clean.phase = 'revealed';
      } else {
        clean.phase = 'setup';
        clean.pending = null;
      }
    }
    return clean;
  } catch (error) {
    console.warn('Không đọc được dữ liệu cũ:', error);
    return initialState();
  }
}

let state = loadState();
let toastTimer = null;
let finalTimer = null;
let spinGuard = 0;
let tickTimer = null;
let audioContext = null;
let storageWarningShown = false;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    if (!storageWarningShown) {
      storageWarningShown = true;
      showToast('Không lưu được dữ liệu: vui lòng kiểm tra chế độ riêng tư / bộ nhớ trình duyệt.');
    }
    return false;
  }
}

function showToast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 4200);
}

function makeElement(tag, className, textValue) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textValue !== undefined) element.textContent = textValue;
  return element;
}

function renderPlayerInputs() {
  const container = $('player-inputs');
  container.replaceChildren();
  state.draftNames.forEach((name, index) => {
    const row = makeElement('div', 'player-input-row');
    const label = makeElement('label', 'player-input-badge', String(index + 1));
    const input = makeElement('input', 'player-name-input');
    input.type = 'text';
    input.maxLength = 50;
    input.placeholder = `Người chơi ${index + 1}`;
    input.value = name;
    input.autocomplete = 'off';
    input.id = `player-name-${index}`;
    input.setAttribute('aria-label', `Tên người chơi ${index + 1}`);
    label.htmlFor = input.id;
    input.addEventListener('input', () => {
      state.draftNames[index] = input.value;
      persist();
    });
    row.append(label, input);
    container.appendChild(row);
  });
  $('player-count').textContent = String(state.draftNames.length);
  $('decrease-count').disabled = state.draftNames.length <= MIN_PLAYERS;
  $('increase-count').disabled = state.draftNames.length >= MAX_PLAYERS;
  drawWheel($('preview-wheel'), state.draftNames.length, []);
}

function changePlayerCount(delta) {
  if (state.phase !== 'setup') return;
  const next = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, state.draftNames.length + delta));
  if (next === state.draftNames.length) return;
  state.draftNames = Array.from({ length: next }, (_, i) => state.draftNames[i] || '');
  persist();
  renderPlayerInputs();
}

// Uniform choice among the remaining integers, using unbiased rejection sampling.
function secureIndex(length) {
  if (!Number.isInteger(length) || length < 1) throw new Error('Không có số hợp lệ để quay.');
  if (!globalThis.crypto || !crypto.getRandomValues) {
    // Older insecure contexts can lack Web Crypto; the standard Math.random fallback
    // is still suitable for this non-monetary office game.
    return Math.floor(Math.random() * length);
  }
  const range = 0x100000000;
  const ceiling = Math.floor(range / length) * length;
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= ceiling);
  return values[0] % length;
}

function getRemainingNumbers() {
  const used = new Set(state.players.map(player => player.number).filter(value => value != null));
  return Array.from({ length: state.players.length }, (_, i) => i + 1).filter(value => !used.has(value));
}

function initGame(names) {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    showToast('Số người chơi phải từ 2 đến 20.');
    return;
  }
  cancelTimers();
  state.players = names.map((raw, index) => ({
    id: `person-${index + 1}`,
    name: String(raw ?? '').trim().slice(0, 50) || `Người ${index + 1}`,
    number: null
  }));
  state.currentIndex = 0;
  state.rotation = 0;
  state.pending = null;
  state.phase = 'ready';
  state.roundId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelTimers() {
  spinGuard += 1;
  clearTimeout(finalTimer);
  clearTimeout(tickTimer);
  finalTimer = null;
  tickTimer = null;
}

function rotateTarget(index, count, previous) {
  // Segment i is drawn with center at -90deg + i*360/N. Pointer stays at -90deg.
  const required = (360 - (index * 360 / count) % 360) % 360;
  const normalizedPrevious = ((previous % 360) + 360) % 360;
  const extra = (required - normalizedPrevious + 360) % 360;
  const fullTurns = 5 + secureIndex(3); // five to seven full rotations
  return previous + fullTurns * 360 + extra;
}

async function spin() {
  if (state.phase !== 'ready') return;
  const current = state.players[state.currentIndex];
  const remaining = getRemainingNumbers();
  if (!current || current.number != null || remaining.length === 0) return;

  const number = remaining[secureIndex(remaining.length)];
  const targetRotation = rotateTarget(number - 1, state.players.length, state.rotation);
  state.pending = { number, targetRotation, personId: current.id };
  state.phase = 'spinning';
  // Durably save the result first, before any animation. Double clicks are ignored.
  persist();
  render();
  const ownGuard = spinGuard;
  const rotor = $('spinner-rotor');
  rotor.style.transition = 'none';
  rotor.style.transform = `rotate(${state.rotation}deg)`;

  resumeAudio();
  startTicking(ownGuard);
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (ownGuard !== spinGuard || state.phase !== 'spinning') return;
  rotor.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.12,.75,.13,1)`;
  rotor.style.transform = `rotate(${targetRotation}deg)`;

  let finished = false;
  let watchdog = null;
  const onDone = event => {
    if (event && event.target !== rotor) return;
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    rotor.removeEventListener('transitionend', onDone);
    if (ownGuard !== spinGuard) return;
    finalizeSpin();
  };
  rotor.addEventListener('transitionend', onDone);
  watchdog = setTimeout(() => onDone(), SPIN_MS + 400);
}

function finalizeSpin() {
  if (state.phase !== 'spinning' || !state.pending) return;
  clearTimeout(tickTimer);
  const pending = state.pending;
  const current = state.players[state.currentIndex];
  if (!current || current.id !== pending.personId) {
    showToast('Không khớp lượt quay; vui lòng tải lại trang.');
    return;
  }
  current.number = pending.number;
  state.rotation = pending.targetRotation;
  state.pending = null;
  state.phase = 'revealed';
  persist();
  playChime();
  render();
  if (state.currentIndex === state.players.length - 1) scheduleFinalReveal();
}

function scheduleFinalReveal() {
  clearTimeout(finalTimer);
  finalTimer = setTimeout(() => {
    if (state.phase === 'revealed' && state.currentIndex === state.players.length - 1) completeRound();
  }, FINAL_REVEAL_MS);
}

function nextTurn() {
  if (state.phase !== 'revealed') return;
  if (state.currentIndex >= state.players.length - 1) {
    completeRound();
    return;
  }
  clearTimeout(finalTimer);
  state.currentIndex += 1;
  state.phase = 'ready';
  persist();
  render();
}

function completeRound() {
  if (state.phase === 'complete' || state.phase !== 'revealed') return;
  if (state.players.some(player => player.number == null)) return;
  clearTimeout(finalTimer);
  state.phase = 'complete';
  state.currentIndex = state.players.length;
  if (!state.history.some(entry => entry.id === state.roundId)) {
    const snapshot = {
      id: state.roundId,
      completedAt: Date.now(),
      players: state.players.map(player => ({ name: player.name, number: player.number }))
    };
    state.history.unshift(snapshot);
    state.history = state.history.slice(0, MAX_HISTORY);
  }
  persist();
  render();
  fireConfetti();
  playFanfare();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function confirmDiscard() {
  if (state.phase === 'ready' || state.phase === 'spinning' || state.phase === 'revealed') {
    return confirm('Bạn muốn dừng vòng hiện tại? Những kết quả của vòng chưa hoàn thành sẽ bị hủy.');
  }
  return true;
}

function startNewRound(reusePlayers) {
  if (!confirmDiscard()) return;
  cancelTimers();
  if (reusePlayers && state.players.length) {
    const names = state.players.map(player => player.name);
    state.draftNames = names.slice();
    initGame(names);
  } else {
    if (state.players.length) state.draftNames = state.players.map(player => player.name);
    state.phase = 'setup';
    state.players = [];
    state.currentIndex = 0;
    state.rotation = 0;
    state.pending = null;
    state.roundId = null;
    persist();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function colorFor(index) { return SEGMENT_COLORS[index % SEGMENT_COLORS.length]; }
function drawWheel(canvas, count, usedNumbers) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width;
  const c = s / 2;
  const radius = c - 13;
  const step = 2 * Math.PI / count;
  const used = new Set(usedNumbers);
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < count; i++) {
    const number = i + 1;
    const center = -Math.PI / 2 + i * step;
    const start = center - step / 2;
    const end = center + step / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    const gradient = ctx.createRadialGradient(0, 0, 75, 0, 0, radius);
    gradient.addColorStop(0, '#fff7e5');
    gradient.addColorStop(.3, colorFor(i));
    gradient.addColorStop(1, colorFor(i));
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = count > 15 ? 4 : 7;
    ctx.strokeStyle = '#fffdfc';
    ctx.stroke();
    if (used.has(number)) {
      ctx.fillStyle = 'rgba(235, 235, 241, .84)';
      ctx.fill();
    }
    const textR = radius * (count > 14 ? .79 : count > 9 ? .73 : .70);
    const x = Math.cos(center) * textR;
    const y = Math.sin(center) * textR;
    const fontSize = count > 15 ? 45 : count > 11 ? 54 : count > 7 ? 69 : 92;
    ctx.font = `950 ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = used.has(number) ? 'rgba(255,255,255,.58)' : 'rgba(255,255,255,.42)';
    ctx.strokeText(String(number), x, y + 3);
    ctx.fillStyle = used.has(number) ? '#92929f' : '#2b3358';
    ctx.fillText(String(number), x, y + 3);
    if (used.has(number) && count <= 12) {
      ctx.font = `800 ${count > 8 ? 18 : 23}px system-ui, sans-serif`;
      ctx.fillStyle = '#96959e';
      ctx.fillText('ĐÃ QUAY', x, y + fontSize * .59);
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius - 3, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,.78)';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
  canvas.setAttribute('aria-label', `Vòng quay ${count} số. Số đã quay: ${used.size ? [...used].sort((a,b)=>a-b).join(', ') : 'chưa có'}.`);
}

function renderGame() {
  const players = state.players;
  const current = players[state.currentIndex];
  const taken = players.filter(player => player.number != null).length;
  const spinning = state.phase === 'spinning';
  const revealed = state.phase === 'revealed';
  drawWheel($('game-wheel'), players.length, players.map(player => player.number).filter(value => value != null));
  const rotor = $('spinner-rotor');
  rotor.style.transition = 'none';
  rotor.style.transform = `rotate(${state.rotation}deg)`;

  $('current-name').textContent = current?.name ?? '';
  $('spin-status-text').textContent = spinning ? 'Vòng quay đang chạy...' : revealed ? 'Đã có kết quả!' : 'Sẵn sàng quay';
  $('turn-counter').textContent = `LƯỢT ${state.currentIndex + 1} / ${players.length}`;
  $('game-guidance').textContent = spinning ? 'Hồi hộp một chút nhé...' : revealed ? 'Xem con số của bạn ở bên dưới!' : 'Nhấn nút để thử vận may của bạn!';
  $('spin-button').disabled = spinning;
  $('spin-button').hidden = revealed;
  $('spin-button').textContent = spinning ? '⏳ ĐANG QUAY...' : '🎯 QUAY MAY MẮN!';
  $('progress-fraction').textContent = `${taken} / ${players.length}`;
  $('progress-bar').style.width = `${taken * 100 / players.length}%`;

  const roster = $('game-roster');
  roster.replaceChildren();
  players.forEach((player, index) => {
    const done = player.number != null;
    const active = index === state.currentIndex && !done;
    const item = makeElement('div', `game-person${done ? ' done' : ''}${active ? ' current' : ''}`);
    const avatar = makeElement('div', 'game-person-avatar', String(index + 1));
    const body = makeElement('div', 'game-person-body');
    const name = makeElement('span', 'game-person-name', player.name);
    const sub = makeElement('span', 'game-person-state', done ? '✓ Đã quay' : active ? spinning ? '🎡 Đang quay...' : '● Đến lượt quay' : 'Chưa đến lượt');
    const result = makeElement('div', `game-person-result${!done ? ' pending' : ''}`, done ? formatNumber(player.number) : '—');
    body.append(name, sub);
    item.append(avatar, body, result);
    roster.append(item);
  });
  $('result-card').hidden = !revealed;
  if (revealed) {
    $('result-person').textContent = current.name;
    $('result-number').textContent = formatNumber(current.number);
    const last = state.currentIndex === players.length - 1;
    $('continue-button').textContent = last ? '🏆 XEM TỔNG KẾT NGAY' : 'TIẾP TỤC NGƯỜI TIẾP THEO →';
    $('auto-summary-note').hidden = !last;
  }
}

function renderSummary() {
  const sorted = [...state.players].sort((a, b) => a.number - b.number);
  const winner = sorted[0];
  $('winner-name').textContent = winner.name;
  $('winner-number').textContent = formatNumber(winner.number);
  $('winner-message').textContent = `Hôm nay ${winner.name} mời nước cả nhóm! 🧋`;
  const leaderboard = $('leaderboard');
  leaderboard.replaceChildren();
  sorted.forEach((player, index) => {
    const row = makeElement('div', `leader-row${index === 0 ? ' first' : ''}`);
    const rank = makeElement('span', 'leader-rank', index === 0 ? '🏆' : `#${index + 1}`);
    const name = makeElement('span', 'leader-name', player.name);
    const score = makeElement('span', 'leader-score', formatNumber(player.number));
    row.append(rank, name, score);
    leaderboard.append(row);
  });
}

function render() {
  const setup = state.phase === 'setup';
  const complete = state.phase === 'complete';
  $('setup-screen').hidden = !setup;
  $('game-screen').hidden = setup || complete;
  $('summary-screen').hidden = !complete;
  updateSoundUI();
  if (setup) renderPlayerInputs();
  else if (complete) renderSummary();
  else renderGame();
}

function renderHistory() {
  const list = $('history-list');
  list.replaceChildren();
  $('clear-history').disabled = state.history.length === 0;
  if (!state.history.length) {
    const empty = makeElement('div', 'history-empty');
    empty.append(makeElement('span', '', '🎡'), makeElement('p', '', 'Chưa có vòng chơi nào được hoàn thành.'));
    list.append(empty);
    return;
  }
  state.history.forEach((entry, index) => {
    if (!Array.isArray(entry.players) || !entry.players.length) return;
    const winner = [...entry.players].sort((a, b) => a.number - b.number)[0];
    const block = makeElement('article', 'history-entry');
    const head = makeElement('div', 'history-entry-header');
    head.append(makeElement('strong', '', `Vòng ${state.history.length - index} · 🥤 ${winner.name}`));
    const date = makeElement('time', '', new Date(entry.completedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }));
    head.append(date);
    const results = [...entry.players].sort((a, b) => a.number - b.number).map(player => `${player.name}: ${formatNumber(player.number)}`).join(' · ');
    block.append(head, makeElement('p', '', results));
    list.append(block);
  });
}

function updateSoundUI() {
  $('sound-icon').textContent = state.sound ? '🔊' : '🔇';
  $('sound-text').textContent = state.sound ? 'Có âm thanh' : 'Đã tắt tiếng';
  $('sound-toggle').setAttribute('aria-label', state.sound ? 'Tắt âm thanh' : 'Bật âm thanh');
  $('sound-toggle').setAttribute('aria-pressed', String(state.sound));
}

function resumeAudio() {
  if (!state.sound) return;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch (error) { /* Audio is optional: spinning always works. */ }
}

function tone(frequency, duration, type = 'sine', gain = .12, delay = 0) {
  if (!state.sound || !audioContext || audioContext.state !== 'running') return;
  try {
    const begin = audioContext.currentTime + delay;
    const osc = audioContext.createOscillator();
    const volume = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, begin);
    volume.gain.setValueAtTime(.0001, begin);
    volume.gain.exponentialRampToValueAtTime(Math.max(.001, gain), begin + .01);
    volume.gain.exponentialRampToValueAtTime(.0001, begin + duration);
    osc.connect(volume);
    volume.connect(audioContext.destination);
    osc.start(begin);
    osc.stop(begin + duration + .03);
  } catch (error) { /* No audio support: ignore silently. */ }
}

function startTicking(token) {
  let tick = 0;
  function tickOnce() {
    if (token !== spinGuard || state.phase !== 'spinning') return;
    tone(tick % 2 ? 610 : 680, .033, 'square', .025);
    tick += 1;
    const fraction = Math.min(1, tick / 39);
    tickTimer = setTimeout(tickOnce, 67 + Math.round(170 * fraction ** 2));
  }
  tickOnce();
}

function playChime() {
  if (!state.sound) return;
  tone(523.25, .18, 'sine', .085, 0);
  tone(659.25, .20, 'sine', .085, .12);
  tone(783.99, .35, 'sine', .09, .25);
}
function playFanfare() {
  if (!state.sound) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(freq, index === 3 ? .58 : .24, 'triangle', .11, index * .17));
}

function fireConfetti() {
  const layer = $('confetti-layer');
  layer.replaceChildren();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff6c91', '#ffd16c', '#73c9f1', '#74dbab', '#ad8afb', '#ff9971'];
  for (let index = 0; index < 90; index++) {
    const element = makeElement('span', 'confetti-particle');
    element.style.background = colors[index % colors.length];
    element.style.setProperty('--pos-x', `${Math.random() * 100}%`);
    element.style.setProperty('--drift', `${Math.random() * 320 - 160}px`);
    element.style.setProperty('--fall-duration', `${2.3 + Math.random() * 2.5}s`);
    element.style.animationDelay = `${Math.random() * 1.2}s`;
    element.style.width = `${5 + Math.random() * 10}px`;
    element.style.height = `${9 + Math.random() * 15}px`;
    layer.append(element);
  }
  setTimeout(() => layer.replaceChildren(), 6000);
}

function setupActions() {
  $('decrease-count').addEventListener('click', () => changePlayerCount(-1));
  $('increase-count').addEventListener('click', () => changePlayerCount(1));
  $('start-button').addEventListener('click', () => initGame(state.draftNames));
  $('spin-button').addEventListener('click', spin);
  $('continue-button').addEventListener('click', nextTurn);
  $('reset-active').addEventListener('click', () => startNewRound(true));
  $('replay-button').addEventListener('click', () => startNewRound(true));
  $('edit-button').addEventListener('click', () => startNewRound(false));
  $('sound-toggle').addEventListener('click', () => {
    state.sound = !state.sound;
    persist();
    updateSoundUI();
    if (state.sound) { resumeAudio(); tone(880, .12, 'sine', .08); }
    else clearTimeout(tickTimer);
  });
  $('history-toggle').addEventListener('click', () => {
    renderHistory();
    $('history-dialog').showModal();
  });
  $('close-history').addEventListener('click', () => $('history-dialog').close());
  $('done-history').addEventListener('click', () => $('history-dialog').close());
  $('history-dialog').addEventListener('click', event => {
    if (event.target === $('history-dialog')) $('history-dialog').close();
  });
  $('clear-history').addEventListener('click', () => {
    if (!state.history.length) return;
    if (!confirm('Xóa toàn bộ lịch sử vòng quay đã lưu trên thiết bị này?')) return;
    state.history = [];
    persist();
    renderHistory();
    showToast('Đã xóa lịch sử trên thiết bị.');
  });
  $('fullscreen-toggle').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else showToast('Trình duyệt này không hỗ trợ toàn màn hình.');
    } catch (error) { showToast('Không bật được chế độ toàn màn hình.'); }
  });
  $('home-link').addEventListener('click', event => {
    event.preventDefault();
    startNewRound(false);
  });
  document.addEventListener('visibilitychange', () => {
    // A backgrounded tab may suspend timers/transition events. The pending result remains saved.
    if (document.visibilityState === 'visible' && state.phase === 'spinning' && state.pending) {
      const computed = getComputedStyle($('spinner-rotor'));
      if (!computed) return;
    }
  });
}

function boot() {
  setupActions();
  render();
  if (state.phase === 'revealed' && state.currentIndex === state.players.length - 1) scheduleFinalReveal();
  // PWA is optional. Local file previews also work, except service worker installation.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.info('PWA không được đăng ký:', error)));
  }
  persist();
}

boot();
