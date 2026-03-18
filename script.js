
/**
 * PIONEER CT-W606DR TAPE ENGINE
 * Features: Web Audio API, Tape Hiss, Saturation, Wow/Flutter, Real-time V-Meter
 */

const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meterContainer = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, mainGain, analyser, dataArray, segs;

// --- 1. INITIALIZE UI METERS ---
function buildMeters() {
    if (!meterContainer) return;
    meterContainer.innerHTML = ''; 
    for(let i = 0; i < 30; i++) {
        const s = document.createElement('div');
        s.className = 'seg';
        meterContainer.appendChild(s);
    }
    segs = document.querySelectorAll('.seg');
}

// Build immediately and also on window load as a backup
buildMeters();
window.onload = buildMeters;

// --- 2. THE ANALOG TAPE ENGINE ---
async function initTapeEngine() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create Media Source
    source = audioCtx.createMediaElementSource(audio);
    
    // Analyser for real-time meters
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128; // Increased for better accuracy
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Audio Nodes
    const saturator = audioCtx.createWaveShaper();
    const shelf = audioCtx.createBiquadFilter();
    const wobble = audioCtx.createDelay();
    hissGain = audioCtx.createGain();
    mainGain = audioCtx.createGain();

    // --- WOW & FLUTTER (Speed Drift) ---
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.45; 
    lfoGain.gain.value = 0.0007; 
    lfo.connect(lfoGain);
    lfoGain.connect(wobble.delayTime);
    lfo.start();

    // --- TAPE SATURATION (Warmth) ---
    saturator.curve = (function(amount) {
        let n = 44100, curve = new Float32Array(n), x;
        for (let i = 0; i < n; ++i ) {
            x = i * 2 / n - 1;
            curve[i] = (3 + amount) * x * 20 * (Math.PI / 180) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    })(55); // Noticeable analog thickness

    // --- TAPE HISS ---
    const bufferSize = 3 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    
    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = 6000;
    hissGain.gain.value = 0.018; 

    // --- ANALOG SHELF (Rolls off digital sharpness) ---
    shelf.type = "highshelf";
    shelf.frequency.value = 10500;
    shelf.gain.value = -6;

    // --- SIGNAL ROUTING ---
    // Music Path
    source.connect(wobble);
    wobble.connect(saturator);
    saturator.connect(shelf);
    shelf.connect(analyser);
    analyser.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // Hiss Path
    whiteNoise.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    whiteNoise.start();
    drawMeter();
}

// --- 3. ANIMATION LOOP ---
function drawMeter() {
    requestAnimationFrame(drawMeter);
    
    if (!analyser || audio.paused || !segs) {
        if (segs) segs.forEach(s => s.classList.remove('on-green', 'on-red'));
        return;
    }

    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume from the low/mid frequencies
    let sum = 0;
    let count = 15; // Only look at the first 15 frequency bins for punchier response
    for(let i = 0; i < count; i++) { sum += dataArray[i]; }
    let average = sum / count;
    
    // Scale 0-255 to 0-30 segments
    let level = Math.floor((average / 140) * 30); 

    segs.forEach((seg, i) => {
        seg.className = 'seg';
        if(i < level) {
            seg.classList.add(i > 23 ? 'on-red' : 'on-green');
        }
    });
}

// --- 4. PLAYER CONTROLS ---
async function playAudio() {
    if(audio.src) {
        if (!audioCtx) await initTapeEngine();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        audio.play();
        spindles.forEach(s => s.classList.add('spinning'));
    } else {
        alert("Please load an MP3 file first!");
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

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        audio.src = URL.createObjectURL(e.target.files[0]);
        // Auto-close doors visually
        document.querySelectorAll('.cassette-door').forEach(d => d.classList.remove('open'));
    }
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
