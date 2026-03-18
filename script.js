const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meter = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

// --- Web Audio API Setup ---
let audioCtx;
let source;
let hissNode;
let hissGain; // Moved to global so Dolby can find it
let gainNode;
let saturator;
let dolbyOn = false;

function initAudioContext() {
    if (audioCtx) return;
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 1. Create Source
    source = audioCtx.createMediaElementSource(audio);

    // 2. Create Tape Hiss (White Noise)
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    hissNode = audioCtx.createBufferSource();
    hissNode.buffer = noiseBuffer;
    hissNode.loop = true;
    
    hissGain = audioCtx.createGain();
    hissGain.gain.value = 0.005; // Starting subtle hiss

    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = 8000; 

    // 3. Create "Warmth" (Saturator/Waveshaper)
    saturator = audioCtx.createWaveShaper();
    saturator.curve = makeDistortionCurve(5); // Fixed at 5 for clear sound
    saturator.oversample = '4x';

    // 4. Analog Roll-off (High shelf)
    const shelf = audioCtx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 12000;
    shelf.gain.value = -1; // Brighter than before, but still analog

    gainNode = audioCtx.createGain();
    gainNode.gain.value = document.getElementById('volume').value;

    // Wiring
    hissNode.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);
    
    source.connect(saturator);
    saturator.connect(shelf);
    shelf.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    hissNode.start();
}

function makeDistortionCurve(amount) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// --- NEW: Dolby NR Toggle ---
function toggleDolby() {
    const btn = document.getElementById('dolbyBtn');
    if (!hissGain) return;

    dolbyOn = !dolbyOn;

    if (dolbyOn) {
        // Drop hiss to almost zero and light up button
        hissGain.gain.setTargetAtTime(0.001, audioCtx.currentTime, 0.1);
        btn.style.color = "var(--pioneer-gold)";
        btn.innerText = "DOLBY NR: ON";
    } else {
        // Bring hiss back to normal
        hissGain.gain.setTargetAtTime(0.005, audioCtx.currentTime, 0.1);
        btn.style.color = "#888";
        btn.innerText = "DOLBY NR: OFF";
    }
}

// --- Logic ---

for(let i=0; i<30; i++) {
    const s = document.createElement('div');
    s.className = 'seg';
    meter.appendChild(s);
}
const segs = document.querySelectorAll('.seg');

fileInput.onchange = function(e) {
    const files = e.target.files;
    if(files.length > 0) {
        const url = URL.createObjectURL(files[0]);
        audio.src = url;
        document.getElementById('door1').classList.remove('open');
        document.getElementById('door2').classList.remove('open');
    }
};

function toggleEject(id) {
    document.getElementById(id).classList.toggle('open');
    pauseAudio();
}

async function playAudio() {
    if(audio.src) {
        if (!audioCtx) initAudioContext();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        audio.volume = 0; // The "No Distortion" fix
        audio.play();
        spindles.forEach(s => s.classList.add('spinning'));
    }
}

function pauseAudio() {
    audio.pause();
    spindles.forEach(s => s.classList.remove('spinning'));
}

function updateVol() { 
    const val = document.getElementById('volume').value;
    if (gainNode) gainNode.gain.value = val;
}

function rewind() { audio.currentTime -= 5; }
function forward() { audio.currentTime += 5; }

audio.ontimeupdate = () => {
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60);
    timer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    
    if(!audio.paused) {
        const level = Math.floor(Math.random() * 30);
        segs.forEach((seg, i) => {
            seg.className = 'seg' + (i < level ? (i > 24 ? ' on-red' : ' on-green') : '');
        });
    }
};

audio.onended = () => spindles.forEach(s => s.classList.remove('spinning'));
