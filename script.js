const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meterContainer = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, mainGain, preAmp;

// --- 1. THE "NO-DISTORTION" TAPE ENGINE ---
async function initTapeEngine() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaElementSource(audio);
    
    // PRE-AMP: Lowering the raw MP3 volume to prevent digital clipping
    preAmp = audioCtx.createGain();
    preAmp.gain.value = 0.6; // Reduce input to 60% to create "Headroom"

    // TAPE HEAD (Subtle High-End Roll-off)
    const shelf = audioCtx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 13000; 
    shelf.gain.value = -3; 

    // WOBBLE (Wow & Flutter)
    const wobble = audioCtx.createDelay();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3; 
    lfoGain.gain.value = 0.0004; 
    lfo.connect(lfoGain);
    lfoGain.connect(wobble.delayTime);
    lfo.start();

    // TAPE HISS
    hissGain = audioCtx.createGain();
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = 8000;
    hissGain.gain.value = 0.01; // Very subtle background hiss

    // MAIN VOLUME CONTROL
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.8;

    // ROUTING: Source -> PreAmp -> Wobble -> Shelf -> MainGain -> Out
    source.connect(preAmp);
    preAmp.connect(wobble);
    wobble.connect(shelf);
    shelf.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // Hiss Path
    whiteNoise.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    whiteNoise.start();
}

// --- 2. CONTROLS ---
async function playAudio() {
    if(audio.src) {
        if (!audioCtx) await initTapeEngine();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        audio.play();
        spindles.forEach(s => s.classList.add('spinning'));
    }
}

function pauseAudio() {
    audio.pause();
    spindles.forEach(s => s.classList.remove('spinning'));
}

function updateVol() {
    const v = document.getElementById('volume').value;
    if (mainGain) mainGain.gain.value = v;
}

fileInput.onchange = (e) => {
    audio.src = URL.createObjectURL(e.target.files[0]);
};

audio.ontimeupdate = () => {
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60);
    timer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
};

function rewind() { audio.currentTime -= 5; }
function forward() { audio.currentTime += 5; }
function toggleEject(id) {
    document.getElementById(id).classList.toggle('open');
    pauseAudio();
}
