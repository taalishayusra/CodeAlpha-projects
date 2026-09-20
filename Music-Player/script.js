/* =============================================================
   Rhythmix – Music Player  |  script.js
   ============================================================= */

// ─── PLAYLIST DATA ────────────────────────────────────────────
// Each track has a unique synth "recipe": root note, chord intervals,
// waveform types, BPM, and filter settings — all played via Web Audio API.
const TRACKS = [
  // ── REAL AUDIO TRACK ─────────────────────────────────────────
  // Place "youre-my-love.mp3" inside the music-player folder.
  {
    title: "You're My Love",     artist: "KK & Tulsi Kumar",    genre: "Bollywood",
    emoji: "❤️", duration: "5:15", color: "#f43f5e",
    src: "youre-my-love.mp3"   // ← put the MP3 file here with this exact name
  },

  // ── SYNTH DEMO TRACKS ─────────────────────────────────────────
  {
    title: "Neon Dreams",        artist: "The Electric Waves",  genre: "Synthwave",
    emoji: "🎸", duration: "3:42", color: "#a78bfa",
    synth: { root: 220, wave: "sawtooth",  bpm: 128, intervals: [0,7,12,19], filterFreq: 1800, delay: true  }
  },
  {
    title: "Midnight Haze",      artist: "Luna & The Stars",    genre: "Ambient",
    emoji: "🌙", duration: "4:15", color: "#60a5fa",
    synth: { root: 174, wave: "sine",      bpm: 72,  intervals: [0,4,7,11],  filterFreq: 900,  delay: true  }
  },
  {
    title: "Crimson Pulse",      artist: "Vortex Engine",       genre: "EDM",
    emoji: "🔥", duration: "3:58", color: "#f472b6",
    synth: { root: 261, wave: "square",    bpm: 140, intervals: [0,7,12,19], filterFreq: 2400, delay: false }
  },
  {
    title: "Golden Hour",        artist: "Sunray Collective",   genre: "Lo-Fi",
    emoji: "☀️", duration: "3:20", color: "#fbbf24",
    synth: { root: 196, wave: "triangle",  bpm: 85,  intervals: [0,4,7,12],  filterFreq: 1200, delay: true  }
  },
  {
    title: "Digital Ocean",      artist: "Wave Breaker",        genre: "Chillwave",
    emoji: "🌊", duration: "5:02", color: "#34d399",
    synth: { root: 164, wave: "sine",      bpm: 95,  intervals: [0,5,9,14],  filterFreq: 1000, delay: true  }
  },
  {
    title: "Voltage Rush",       artist: "Cyber Pulse",         genre: "Trap",
    emoji: "⚡", duration: "2:55", color: "#f97316",
    synth: { root: 293, wave: "sawtooth",  bpm: 150, intervals: [0,3,7,10],  filterFreq: 3000, delay: false }
  },
  {
    title: "Astral Projection",  artist: "Cosmos Float",        genre: "Space",
    emoji: "🚀", duration: "4:30", color: "#818cf8",
    synth: { root: 130, wave: "sine",      bpm: 60,  intervals: [0,7,12,16], filterFreq: 700,  delay: true  }
  },
  {
    title: "Velvet Underground", artist: "Deep Frequency",      genre: "Soul",
    emoji: "🎷", duration: "3:10", color: "#e879f9",
    synth: { root: 246, wave: "triangle",  bpm: 100, intervals: [0,4,7,10],  filterFreq: 1400, delay: true  }
  },
];

// ─── WEB AUDIO ENGINE ─────────────────────────────────────────
let audioCtx       = null;
let masterGain     = null;
let activeNodes    = [];   // currently playing oscillator nodes
let beatInterval   = null; // setInterval for rhythmic notes

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = parseInt(volumeSlider.value) / 100;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function stopAllNodes() {
  clearInterval(beatInterval);
  activeNodes.forEach(n => {
    try { n.stop(); } catch(e) {}
  });
  activeNodes = [];
}

// Play a short note (frequency, duration in seconds, volume 0-1)
function playNote(freq, dur, vol, wave, filterFreq) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = wave;
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.start(now);
  osc.stop(now + dur + 0.05);
  activeNodes.push(osc);
}

// Add a delay/echo effect node
function createDelayLoop(freq, wave, filterFreq) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const delay = ctx.createDelay(1.5);
  const feedback = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = wave;
  osc.frequency.value = freq * 0.5; // sub-octave pad
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq * 0.6;

  delay.delayTime.value = 0.35;
  feedback.gain.value = 0.4;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(masterGain);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 1.5);

  osc.start(now);
  activeNodes.push(osc);
  return osc;
}

// Start synthesized music for given track index
function startSynth(trackIdx) {
  stopAllNodes();
  const track = TRACKS[trackIdx];
  const { root, wave, bpm, intervals, filterFreq, delay } = track.synth;
  const beatSec = 60 / bpm;
  const freqs = intervals.map(i => root * Math.pow(2, i / 12));

  // Long pad (always on)
  freqs.forEach((f, i) => {
    const osc = getAudioCtx().createOscillator();
    const g   = getAudioCtx().createGain();
    const flt = getAudioCtx().createBiquadFilter();
    osc.type = wave === 'sawtooth' ? 'sine' : wave;
    osc.frequency.value = f;
    flt.type = 'lowpass';
    flt.frequency.value = filterFreq * 0.7;
    osc.connect(flt); flt.connect(g); g.connect(masterGain);
    const now = getAudioCtx().currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.07 - i * 0.01, now + 1.0);
    osc.start(now);
    activeNodes.push(osc);
  });

  // Optional delay pad
  if (delay) createDelayLoop(freqs[0], wave, filterFreq);

  // Rhythmic arpeggio beats
  let beat = 0;
  const arpFreqs = [...freqs, freqs[0] * 2, freqs[1] * 2];
  beatInterval = setInterval(() => {
    if (audioCtx && audioCtx.state !== 'suspended') {
      const f = arpFreqs[beat % arpFreqs.length];
      playNote(f, beatSec * 0.7, 0.18, wave, filterFreq);
      // Bass note every 2 beats
      if (beat % 2 === 0) playNote(root * 0.5, beatSec * 1.4, 0.14, 'sine', 300);
    }
    beat++;
  }, beatSec * 1000);
}

// ─── STATE ────────────────────────────────────────────────────
let currentIndex = 0;
let isPlaying    = false;
let isShuffle    = false;
let repeatMode   = 0;   // 0=off, 1=repeat all, 2=repeat one
let isMuted      = false;
let prevVolume   = 80;
let progressTimer= null;
let elapsed      = 0;
let totalDur     = 0;
let isDragging   = false;

// ─── DOM REFS ─────────────────────────────────────────────────
const audioEl       = document.getElementById('audioPlayer'); // HTML <audio> element
const playBtn       = document.getElementById('playBtn');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const shuffleBtn    = document.getElementById('shuffleBtn');
const repeatBtn     = document.getElementById('repeatBtn');
const muteBtn       = document.getElementById('muteBtn');
const volumeSlider  = document.getElementById('volumeSlider');
const volPct        = document.getElementById('volPct');
const progressTrack = document.getElementById('progressTrack');
const progressFill  = document.getElementById('progressFill');
const progressThumb = document.getElementById('progressThumb');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl   = document.getElementById('totalTime');
const trackTitleEl  = document.getElementById('trackTitle');
const trackArtistEl = document.getElementById('trackArtist');
const genreBadgeEl  = document.getElementById('genreBadge');
const albumEmojiEl  = document.getElementById('albumEmoji');
const albumGlowEl   = document.getElementById('albumGlow');
const albumArtEl    = document.getElementById('albumArt');
const playlistEl    = document.getElementById('playlist');
const trackCountEl  = document.getElementById('trackCount');
const iconPlay      = playBtn.querySelector('.icon-play');
const iconPause     = playBtn.querySelector('.icon-pause');

// ─── HELPERS ──────────────────────────────────────────────────
function parseDuration(str) {
  const [m, s] = str.split(':').map(Number);
  return m * 60 + s;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── PLAYLIST RENDER ──────────────────────────────────────────
function buildPlaylist() {
  playlistEl.innerHTML = '';
  TRACKS.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'playlist-item' + (i === currentIndex ? ' active' : '');
    li.setAttribute('role', 'listitem');
    li.setAttribute('tabindex', '0');
    li.id = `track-${i}`;
    li.innerHTML = `
      <span class="item-num">${i + 1}</span>
      <span class="item-playing-icon">
        <span class="eq-bars${isPlaying ? '' : ' paused'}">
          <span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span>
        </span>
      </span>
      <span class="item-emoji">${track.emoji}</span>
      <span class="item-info">
        <span class="item-title">${track.title}</span>
        <span class="item-artist">${track.artist}</span>
      </span>
      <span class="item-duration">${track.duration}</span>
    `;
    li.addEventListener('click', () => loadTrack(i, true));
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadTrack(i, true); } });
    playlistEl.appendChild(li);
  });
  trackCountEl.textContent = `${TRACKS.length} tracks`;
}

function updatePlaylistActive() {
  document.querySelectorAll('.playlist-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentIndex);
    const eq = el.querySelector('.eq-bars');
    if (eq) eq.classList.toggle('paused', !isPlaying);
  });
  const active = document.getElementById(`track-${currentIndex}`);
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── LOAD TRACK ───────────────────────────────────────────────
function isRealAudio(track) { return !!track.src; }

function loadTrack(index, autoPlay = false) {
  currentIndex = index;
  const track = TRACKS[index];

  totalDur = parseDuration(track.duration);
  elapsed  = 0;

  trackTitleEl.textContent  = track.title;
  trackArtistEl.textContent = track.artist;
  genreBadgeEl.textContent  = track.genre;
  albumEmojiEl.textContent  = track.emoji;
  totalTimeEl.textContent   = track.duration;
  currentTimeEl.textContent = '0:00';
  albumGlowEl.style.background = `radial-gradient(circle, ${track.color}44 0%, transparent 70%)`;

  setProgress(0);
  stopPlaybackTimer();
  stopAllNodes();

  // Set up real audio element if track has a src
  audioEl.pause();
  audioEl.src = '';
  if (isRealAudio(track)) {
    audioEl.src = track.src;
    audioEl.load();
    // Once metadata loads, update the real duration
    audioEl.onloadedmetadata = () => {
      totalDur = Math.floor(audioEl.duration);
      totalTimeEl.textContent = formatTime(totalDur);
    };
    audioEl.onerror = () => showToast('⚠️ MP3 not found — place youre-my-love.mp3 in the folder');
  }

  if (autoPlay) startPlayback();
  else pausePlayback();

  updatePlaylistActive();
  document.title = `▶ ${track.title} – Rhythmix`;
}

// ─── PLAYBACK ─────────────────────────────────────────────────
function startPlayback() {
  isPlaying = true;
  iconPlay.classList.add('hidden');
  iconPause.classList.remove('hidden');
  albumArtEl.classList.add('spinning');

  if (isRealAudio(TRACKS[currentIndex])) {
    // Real MP3: use the HTML audio element
    audioEl.volume = parseInt(volumeSlider.value) / 100;
    audioEl.play().catch(() => showToast('⚠️ MP3 not found — place youre-my-love.mp3 in the folder'));
  } else {
    // Synth demo track
    getAudioCtx();
    startSynth(currentIndex);
    startPlaybackTimer();
  }
  updatePlaylistActive();
}

function pausePlayback() {
  isPlaying = false;
  iconPlay.classList.remove('hidden');
  iconPause.classList.add('hidden');
  albumArtEl.classList.remove('spinning');

  if (isRealAudio(TRACKS[currentIndex])) {
    audioEl.pause();
  } else {
    stopAllNodes();
    stopPlaybackTimer();
  }
  updatePlaylistActive();
}

function togglePlay() {
  if (isPlaying) pausePlayback();
  else startPlayback();
}

// ─── PROGRESS TIMER ───────────────────────────────────────────
function startPlaybackTimer() {
  stopPlaybackTimer();
  progressTimer = setInterval(() => {
    if (isDragging) return;
    elapsed++;
    if (elapsed >= totalDur) {
      elapsed = totalDur;
      setProgress(100);
      onTrackEnd();
      return;
    }
    setProgress((elapsed / totalDur) * 100);
    currentTimeEl.textContent = formatTime(elapsed);
  }, 1000);
}

function stopPlaybackTimer() {
  clearInterval(progressTimer);
  progressTimer = null;
}

function onTrackEnd() {
  stopPlaybackTimer();
  stopAllNodes();
  if (repeatMode === 2) {
    loadTrack(currentIndex, true);
  } else if (repeatMode === 1 || currentIndex < TRACKS.length - 1) {
    nextTrack();
  } else {
    pausePlayback();
    elapsed = 0;
    setProgress(0);
    currentTimeEl.textContent = '0:00';
  }
}

function nextTrack() {
  let idx;
  if (isShuffle) {
    do { idx = Math.floor(Math.random() * TRACKS.length); } while (idx === currentIndex && TRACKS.length > 1);
  } else {
    idx = (currentIndex + 1) % TRACKS.length;
  }
  loadTrack(idx, true);
}

function prevTrack() {
  const track = TRACKS[currentIndex];
  const curSec = isRealAudio(track) ? Math.floor(audioEl.currentTime) : elapsed;
  if (curSec > 3) {
    // Restart current track
    if (isRealAudio(track)) {
      audioEl.currentTime = 0;
    } else {
      elapsed = 0;
      setProgress(0);
      currentTimeEl.textContent = '0:00';
      if (isPlaying) { stopPlaybackTimer(); stopAllNodes(); startSynth(currentIndex); startPlaybackTimer(); }
    }
    return;
  }
  loadTrack((currentIndex - 1 + TRACKS.length) % TRACKS.length, isPlaying);
}

// ─── PROGRESS BAR ─────────────────────────────────────────────
function setProgress(pct) {
  pct = Math.min(100, Math.max(0, pct));
  progressFill.style.width = pct + '%';
  progressThumb.style.left = pct + '%';
}

function seekTo(e) {
  const rect = progressTrack.getBoundingClientRect();
  let pct = (e.clientX - rect.left) / rect.width;
  pct = Math.min(1, Math.max(0, pct));
  const track = TRACKS[currentIndex];
  if (isRealAudio(track) && audioEl.duration) {
    audioEl.currentTime = pct * audioEl.duration;
  } else {
    elapsed = Math.floor(pct * totalDur);
    setProgress(pct * 100);
    currentTimeEl.textContent = formatTime(elapsed);
  }
}

progressTrack.addEventListener('mousedown', e => { isDragging = true; seekTo(e); });
document.addEventListener('mousemove',  e => { if (!isDragging) return; seekTo(e); });
document.addEventListener('mouseup',    () => { isDragging = false; });
progressTrack.addEventListener('touchstart', e => { isDragging = true; seekTo(e.touches[0]); }, { passive: true });
document.addEventListener('touchmove',  e => { if (!isDragging) return; seekTo(e.touches[0]); }, { passive: true });
document.addEventListener('touchend',   () => { isDragging = false; });

// ─── HTML AUDIO ELEMENT EVENTS (for real MP3 tracks) ──────────
audioEl.addEventListener('timeupdate', () => {
  if (!isRealAudio(TRACKS[currentIndex]) || isDragging) return;
  const cur = audioEl.currentTime;
  const dur = audioEl.duration || totalDur;
  elapsed = Math.floor(cur);
  setProgress((cur / dur) * 100);
  currentTimeEl.textContent = formatTime(cur);
});

audioEl.addEventListener('ended', () => {
  if (!isRealAudio(TRACKS[currentIndex])) return;
  onTrackEnd();
});

// ─── VOLUME ───────────────────────────────────────────────────
function updateVolume(val) {
  val = Math.min(100, Math.max(0, val));
  volumeSlider.value = val;
  volPct.textContent = val + '%';
  if (masterGain) masterGain.gain.value = val / 100;
  audioEl.volume = val / 100; // also update HTML audio element
  volumeSlider.style.background = `linear-gradient(to right, #a78bfa ${val}%, rgba(255,255,255,0.12) ${val}%)`;

  const path = document.getElementById('volIcon').querySelector('path');
  if (val === 0) {
    path.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
  } else if (val < 50) {
    path.setAttribute('d', 'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z');
  } else {
    path.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
  }
}

volumeSlider.addEventListener('input', () => {
  isMuted = false;
  prevVolume = parseInt(volumeSlider.value);
  updateVolume(prevVolume);
});

muteBtn.addEventListener('click', () => {
  if (isMuted) { isMuted = false; updateVolume(prevVolume || 80); }
  else { isMuted = true; prevVolume = parseInt(volumeSlider.value); updateVolume(0); }
});

// ─── SHUFFLE & REPEAT ─────────────────────────────────────────
shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
  showToast(isShuffle ? '🔀 Shuffle on' : '🔀 Shuffle off');
});

repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  repeatBtn.classList.toggle('active', repeatMode > 0);
  showToast(['🔁 Repeat off', '🔁 Repeat all', '🔂 Repeat one'][repeatMode]);
  repeatBtn.title = ['Repeat', 'Repeat All', 'Repeat One'][repeatMode];
});

// ─── CONTROLS ─────────────────────────────────────────────────
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': e.preventDefault(); nextTrack();  break;
    case 'ArrowLeft':  e.preventDefault(); prevTrack();  break;
    case 'ArrowUp':
      e.preventDefault();
      updateVolume(Math.min(100, parseInt(volumeSlider.value) + 5));
      prevVolume = parseInt(volumeSlider.value); break;
    case 'ArrowDown':
      e.preventDefault();
      updateVolume(Math.max(0, parseInt(volumeSlider.value) - 5));
      prevVolume = parseInt(volumeSlider.value); break;
    case 'KeyM': muteBtn.click();   break;
    case 'KeyS': shuffleBtn.click(); break;
    case 'KeyR': repeatBtn.click(); break;
  }
});

// ─── INIT ─────────────────────────────────────────────────────
(function init() {
  buildPlaylist();
  loadTrack(0, false);
  updateVolume(80);
  setTimeout(() => showToast('▶ Press Play to listen!'), 800);
})();
