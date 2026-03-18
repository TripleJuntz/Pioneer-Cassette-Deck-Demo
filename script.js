const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meter = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

let audioCtx;
let source;
let hissGain;
let mainGain;

// 1. Initialize the "Tape Machine" Logic
function initTapeEngine() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create nodes
    source = audioCtx.createMediaElementSource(audio);
    const filter = audioCtx.createBiquadFilter();
    const saturator = audioCtx.createWaveShaper();
    const shelf = audioCtx.createBiquadFilter();
    hissGain = audioCtx.createGain();
    mainGain = audioCtx.createGain();

    // --- TAPE WARMTH (Saturator) ---
    saturator.curve = (function(amount) {
        let k = amount, n = 44100, curve = new Float32Array(n), x;
        for (let i = 0; i < n; ++i ) {
            x = i * 2 / n - 1;
            curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    })(50); // Increased for noticeable warmth

    // --- TAPE HISS GENERATOR ---
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = 7000; // Muffled hiss like real tape
    hissGain.gain.value = 0.02; // Make it audible for testing

    // --- ANALOG ROLL-OFF ---
    shelf.type = "highshelf";
    shelf.frequency.value = 10000;
    shelf.gain.value = -4; // Dulls the digital "crispness"

    // --- CONNECT EVERYTHING ---
    // Music Path: Source -> Saturator -> Shelf -> Main Gain -> Speakers
    source.connect(saturator);
    saturator.connect(shelf);
    shelf.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // Hiss Path: Noise -> Filter -> Hiss Gain -> Speakers
    whiteNoise.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    whiteNoise.start();
    console.log("Tape Engine Active: Hiss and Saturation engaged.");
}

// --- CONTROLS ---

async function playAudio() {
    if(audio.src) {
        await initTapeEngine();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        audio.play();
        spindles.forEach(s => s.classList.add('spinning'));
    } else {
        alert("Load a file first!");
    }
}

function pauseAudio() {
    audio.pause();
    spindles.forEach(s => s.classList.remove('spinning'));
}

function updateVol() {
    const v = document.getElementById('volume').value;
    if (mainGain) mainGain.gain.value = v;
    audio.volume = v;
}

// --- UI HELPERS (V-Meters) ---
for(let i=0; i<30; i++) {
    const s = document.createElement('div');
    s.className = 'seg';
    meter.appendChild(s);
}
const segs = document.querySelectorAll('.seg');

fileInput.onchange = (e) => {
    const url = URL.createObjectURL(e.target.files[0]);
    audio.src = url;
};

audio.ontimeupdate = () => {
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60);
    timer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    
    if(!audio.paused) {
        const level = Math.floor(Math.random() * 30);
        segs.forEach((seg, i) => {
            seg.className = 'seg';
            if(i < level) seg.classList.add(i > 24 ? 'on-red' : 'on-green');
        });
    }
};

// Functions for the buttons
function rewind() { audio.currentTime -= 5; }
function forward() { audio.currentTime += 5; }
function toggleEject(id) {
    document.getElementById(id).classList.toggle('open');
    pauseAudio();
}
