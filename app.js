'use strict';

// Vòng quay may mắn · Trung tâm Bảo trợ xã hội Tân Hiệp · v1.1
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

let migrationNotice = false;

function initialState() {
  return {
    v: 2,
    phase: 'setup',
    draftNames: Array.from({ length: 5 }, () => ''),
    players: [],
    // Each stage includes only players who must spin. A stage is assessed AFTER
    // everyone in that stage has spun independently, using the SAME eligible set.
    queue: [],
    stage: 1,
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
    if (!saved || ![1, 2].includes(saved.v) || !Array.isArray(saved.draftNames) || !Array.isArray(saved.players)) return initialState();
    const clean = { ...initialState(), ...saved };
    clean.draftNames = saved.draftNames.slice(0, MAX_PLAYERS).map(value => String(value ?? '').slice(0, 50));
    if (clean.draftNames.length < MIN_PLAYERS) clean.draftNames = Array.from({ length: 5 }, () => '');
    clean.history = Array.isArray(saved.history) ? saved.history.slice(0, MAX_HISTORY) : [];
    clean.sound = saved.sound !== false;
    if (saved.v === 1) {
      // V1 used a different draw rule (without replacement). Never silently
      // resume those partly assigned numbers under V1.1. Keep names/history.
      migrationNotice = ['ready', 'spinning', 'revealed'].includes(saved.phase);
      if (saved.players.length) clean.draftNames = saved.players.map(p => String(p.name ?? '').slice(0, 50));
      clean.v = 2;
      clean.phase = 'setup';
      clean.players = [];
      clean.queue = [];
      clean.pending = null;
      clean.rotation = 0;
      clean.currentIndex = 0;
      clean.stage = 1;
      clean.roundId = null;
      return clean;
    }
    if (!['setup', 'ready', 'spinning', 'revealed', 'review', 'complete'].includes(clean.phase)) clean.phase = 'setup';
    if (clean.phase !== 'setup') {
      if (clean.players.length < MIN_PLAYERS || clean.players.length > MAX_PLAYERS ||
          !Array.isArray(clean.queue) || !clean.queue.length ||
          !clean.queue.every((index, i) => Number.isInteger(index) && index >= 0 && index < clean.players.length && clean.queue.indexOf(index) === i) ||
          !Number.isInteger(clean.currentIndex) || clean.currentIndex < 0 || clean.currentIndex > clean.queue.length ||
          !Number.isInteger(clean.stage) || clean.stage < 1 ||
          clean.players.some(player => !player || !['waiting','locked','duplicate','drawn'].includes(player.status) ||
            (player.number !== null && (!Number.isInteger(player.number) || player.number < 1 || player.number > clean.players.length)))) {
        clean.phase = 'setup';
        clean.players = [];
        clean.pending = null;
      }
    }
    if (!Number.isFinite(clean.rotation)) clean.rotation = 0;
    // A chosen result is committed BEFORE animation. Reload during the spin
    // reveals the exact same persisted number (no second draw).
    if (clean.phase === 'spinning') {
      const pick = clean.pending;
      const player = clean.players[clean.queue[clean.currentIndex]];
      const locked = new Set(clean.players.filter(p => p.status === 'locked').map(p => p.number));
      const valid = pick && player && player.id === pick.personId && pick.stage === clean.stage &&
        player.number === null && Number.isInteger(pick.number) &&
        pick.number >= 1 && pick.number <= clean.players.length && !locked.has(pick.number) &&
        Number.isFinite(pick.targetRotation);
      if (valid) {
        player.number = pick.number;
        player.status = 'drawn';
        clean.rotation = pick.targetRotation;
        clean.pending = null;
        clean.phase = 'revealed';
      } else {
        clean.phase = 'setup';
        clean.pending = null;
        clean.players = [];
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

function currentPlayer() {
  return state.players[state.queue[state.currentIndex]];
}

function lockedNumbers() {
  return state.players.filter(player => player.status === 'locked').map(player => player.number);
}

// IMPORTANT: Picks are independent WITH replacement within the same stage.
// Only numbers locked by completed previous stages are excluded.
function eligibleNumbers() {
  const locked = new Set(lockedNumbers());
  return Array.from({ length: state.players.length }, (_, i) => i + 1).filter(n => !locked.has(n));
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
    number: null,
    status: 'waiting',
    previousDuplicate: null
  }));
  state.queue = state.players.map((_, index) => index);
  state.stage = 1;
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
  const current = currentPlayer();
  const eligible = eligibleNumbers();
  if (!current || current.number != null || eligible.length === 0) return;

  const number = eligible[secureIndex(eligible.length)];
  const targetRotation = rotateTarget(number - 1, state.players.length, state.rotation);
  state.pending = { number, targetRotation, personId: current.id, stage: state.stage };
  state.phase = 'spinning';
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
  const current = currentPlayer();
  if (!current || current.id !== pending.personId || pending.stage !== state.stage) {
    showToast('Không khớp lượt quay; vui lòng tải lại trang.');
    return;
  }
  current.number = pending.number;
  current.status = 'drawn';
  current.previousDuplicate = null;
  state.rotation = pending.targetRotation;
  state.pending = null;
  state.phase = 'revealed';
  persist();
  playChime();
  render();
  if (state.currentIndex === state.queue.length - 1) scheduleStageReview();
}

function scheduleStageReview() {
  clearTimeout(finalTimer);
  finalTimer = setTimeout(() => {
    if (state.phase === 'revealed' && state.currentIndex === state.queue.length - 1) assessStage();
  }, FINAL_REVEAL_MS);
}

function nextTurn() {
  if (state.phase !== 'revealed') return;
  clearTimeout(finalTimer);
  if (state.currentIndex >= state.queue.length - 1) {
    assessStage();
    return;
  }
  state.currentIndex += 1;
  state.phase = 'ready';
  persist();
  render();
}

function assessStage() {
  if (state.phase !== 'revealed' || state.currentIndex !== state.queue.length - 1) return;
  if (state.queue.some(i => state.players[i].number == null)) return;
  clearTimeout(finalTimer);
  const counts = new Map();
  state.queue.forEach(i => counts.set(state.players[i].number, (counts.get(state.players[i].number) || 0) + 1));
  let duplicates = 0;
  state.queue.forEach(i => {
    const player = state.players[i];
    if (counts.get(player.number) > 1) {
      player.status = 'duplicate';
      duplicates += 1;
    } else {
      player.status = 'locked';
    }
  });
  if (duplicates === 0) {
    completeRound();
  } else {
    state.phase = 'review';
    persist();
    render();
    showToast(`${duplicates} người trùng số! Các bạn này sẽ cùng quay vòng phụ.`);
  }
}

function nextStage() {
  if (state.phase !== 'review') return;
  const reroll = state.players.map((player, index) => player.status === 'duplicate' ? index : -1).filter(i => i >= 0);
  if (reroll.length < 2) return;
  cancelTimers();
  reroll.forEach(i => {
    state.players[i].previousDuplicate = state.players[i].number;
    state.players[i].number = null;
    state.players[i].status = 'waiting';
  });
  state.stage += 1;
  state.queue = reroll;
  state.currentIndex = 0;
  state.phase = 'ready';
  state.pending = null;
  // Keep the previous spin orientation so the wheel does not snap in place.
  persist();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function completeRound() {
  if (state.phase === 'complete' || state.players.some(p => p.status !== 'locked')) return;
  clearTimeout(finalTimer);
  state.phase = 'complete';
  state.currentIndex = state.queue.length;
  if (!state.history.some(entry => entry.id === state.roundId)) {
    const snapshot = {
      id: state.roundId,
      completedAt: Date.now(),
      stages: state.stage,
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
  if (['ready', 'spinning', 'revealed', 'review'].includes(state.phase)) {
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
    state.queue = [];
    state.stage = 1;
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
      ctx.fillText('ĐÃ CHỐT', x, y + fontSize * .59);
    }
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius - 3, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,.78)';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
  canvas.setAttribute('aria-label', `Vòng quay ${count} số. Số đã chốt: ${used.size ? [...used].sort((a,b)=>a-b).join(', ') : 'chưa có'}.`);
}

function renderGame() {
  const players = state.players;
  const current = currentPlayer();
  const stageQueue = state.queue;
  const locked = lockedNumbers();
  const drawnCount = stageQueue.filter(i => players[i].number != null).length;
  const spinning = state.phase === 'spinning';
  const revealed = state.phase === 'revealed';
  const review = state.phase === 'review';
  const secondary = state.stage > 1;
  drawWheel($('game-wheel'), players.length, locked);
  const rotor = $('spinner-rotor');
  rotor.style.transition = 'none';
  rotor.style.transform = `rotate(${state.rotation}deg)`;

  $('current-name').textContent = review ? 'Đã hoàn tất lượt quay' : current?.name ?? '';
  $('spin-status-text').textContent = review ? 'Đã phát hiện kết quả trùng' : spinning ? 'Vòng quay đang chạy...' : revealed ? 'Đã có kết quả!' : 'Sẵn sàng quay';
  $('turn-counter').textContent = `${secondary ? `VÒNG PHỤ ${state.stage - 1}` : 'VÒNG ĐẦU'} · ${review ? stageQueue.length : state.currentIndex + 1}/${stageQueue.length}`;
  $('game-guidance').textContent = review ? 'Kiểm tra kết quả và bắt đầu vòng phụ!' : spinning ? 'Hồi hộp một chút nhé...' : revealed ? 'Xem con số của bạn ở bên dưới!' : secondary ? 'Chỉ quay trong các số chưa có người giữ cố định.' : 'Tất cả người chơi đều có thể trúng bất kỳ số nào từ 1 đến N.';
  $('spin-button').disabled = spinning || review || revealed;
  $('spin-button').hidden = review || revealed;
  $('spin-button').textContent = spinning ? '⏳ ĐANG QUAY...' : '🎯 QUAY MAY MẮN!';
  $('progress-fraction').textContent = `${drawnCount} / ${stageQueue.length}`;
  $('progress-bar').style.width = `${100 * drawnCount / stageQueue.length}%`;
  $('progress-label').textContent = secondary ? `Tiến độ vòng phụ ${state.stage - 1}` : 'Tiến độ vòng đầu';
  $('wheel-legend').textContent = secondary ? '✨ Ô mờ đã được giữ cố định. Người quay vòng phụ được chọn độc lập trong các số còn lại.' : '✨ Vòng đầu mọi người đều có thể trúng số giống nhau. Chỉ lọc trùng sau khi cả nhóm quay xong.';

  const roster = $('game-roster');
  roster.replaceChildren();
  players.forEach((player, index) => {
    const done = player.status === 'locked';
    const duplicate = player.status === 'duplicate';
    const drawn = player.status === 'drawn';
    const active = stageQueue[state.currentIndex] === index && !review && !drawn && !done;
    const item = makeElement('div', `game-person${done ? ' done' : ''}${active ? ' current' : ''}${duplicate ? ' duplicate' : ''}`);
    const avatar = makeElement('div', 'game-person-avatar', String(index + 1));
    const body = makeElement('div', 'game-person-body');
    const name = makeElement('span', 'game-person-name', player.name);
    let label;
    if (done) label = '✓ Giữ số · Đã chốt';
    else if (duplicate) label = '🔁 Trùng số · Quay lại';
    else if (drawn) label = '🎲 Đã quay · Chờ kiểm tra trùng';
    else if (active) label = spinning ? '🎡 Đang quay...' : '● Đến lượt quay';
    else if (secondary && player.previousDuplicate != null) label = `🔁 Đã trùng ${formatNumber(player.previousDuplicate)} · Chờ quay lại`;
    else label = 'Chưa đến lượt';
    const sub = makeElement('span', 'game-person-state', label);
    const result = makeElement('div', `game-person-result${player.number == null ? ' pending' : ''}`, player.number == null ? '—' : formatNumber(player.number));
    body.append(name, sub);
    item.append(avatar, body, result);
    roster.append(item);
  });

  $('result-card').hidden = !revealed;
  $('review-card').hidden = !review;
  if (revealed) {
    $('result-person').textContent = current.name;
    $('result-number').textContent = formatNumber(current.number);
    const last = state.currentIndex === stageQueue.length - 1;
    $('continue-button').textContent = last ? '🔍 KIỂM TRA SỐ TRÙNG' : 'TIẾP TỤC NGƯỜI TIẾP THEO →';
    $('auto-summary-note').hidden = !last;
    $('auto-summary-note').textContent = 'Hệ thống sẽ kiểm tra số trùng sau ít giây...';
  }
  if (review) {
    const duplicates = players.filter(p => p.status === 'duplicate');
    const groups = new Map();
    duplicates.forEach(p => {
      if (!groups.has(p.number)) groups.set(p.number, []);
      groups.get(p.number).push(p.name);
    });
    $('review-title').textContent = `${duplicates.length} NGƯỜI TRÙNG SỐ!`;
    $('review-message').textContent = [...groups].sort((a,b) => a[0]-b[0]).map(([number, names]) => `Số ${formatNumber(number)}: ${names.join(', ')}`).join(' · ');
    $('next-stage-button').textContent = `🔁 QUAY VÒNG PHỤ ${state.stage}`;
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
  $('next-stage-button').addEventListener('click', nextStage);
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
  if (state.phase === 'revealed' && state.currentIndex === state.queue.length - 1) scheduleStageReview();
  // PWA is optional. Local file previews also work, except service worker installation.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(error => console.info('PWA không được đăng ký:', error)));
  }
  persist();
  if (migrationNotice) showToast('V1.1 đã giữ lịch sử và tên người chơi; vòng V1.0 đang dở cần bắt đầu lại theo luật mới.');
}

boot();
