const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meter = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, mainGain, analyser, dataArray;

// 1. Setup the UI Meter Segments
for(let i=0; i<30; i++) {
    const s = document.createElement('div');
    s.className = 'seg';
    meter.appendChild(s);
}
const segs = document.querySelectorAll('.seg');

// 2. The Analog Tape Engine
function initTapeEngine() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Nodes
    source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; // Small for fast meter response
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const saturator = audioCtx.createWaveShaper();
    const shelf = audioCtx.createBiquadFilter();
    const wobble = audioCtx.createDelay();
    hissGain = audioCtx.createGain();
    mainGain = audioCtx.createGain();

    // --- WOW & FLUTTER (The Speed Wobble) ---
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.4; // Slow drift
    lfoGain.gain.value = 0.0006; 
    lfo.connect(lfoGain);
    lfoGain.connect(wobble.delayTime);
    lfo.start();

    // --- TAPE WARMTH (Saturation) ---
    saturator.curve = (function(amount) {
        let n = 44100, curve = new Float32Array(n), x;
        for (let i = 0; i < n; ++i ) {
            x = i * 2 / n - 1;
            curve[i] = (3 + amount) * x * 20 * (Math.PI / 180) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    })(40);

    // --- TAPE HISS ---
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = 6500;
    hissGain.gain.value = 0.015;

    // --- ANALOG ROLL-OFF ---
    shelf.type = "highshelf";
    shelf.frequency.value = 11000;
    shelf.gain.value = -5;

    // --- ROUTING ---
    // Music Path: Source -> Wobble -> Saturator -> Shelf -> Analyser -> Main Gain -> Out
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
    updateMeter();
}

// 3. Real-Time V-Meter Animation
function updateMeter() {
    requestAnimationFrame(updateMeter);
    if (!analyser || audio.paused) {
        segs.forEach(s => s.classList.remove('on-green', 'on-red'));
        return;
    }

    analyser.getByteFrequencyData(dataArray);
    // Get average volume level
    let sum = 0;
    for(let i=0; i<dataArray.length; i++) { sum += dataArray[i]; }
    let average = sum / dataArray.length;
    
    // Scale the 0-255 value to our 30 segments
    let level = Math.floor((average / 120) * 30); 

    segs.forEach((seg, i) => {
        seg.className = 'seg';
        if(i < level) {
            seg.classList.add(i > 22 ? 'on-red' : 'on-green');
        }
    });
}

// --- STANDARD CONTROLS ---
async function playAudio() {
    if(audio.src) {
        await initTapeEngine();
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
    audio.volume = v;
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
