const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meterContainer = document.getElementById('meter'); // The div in your HTML
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, mainGain, analyser, dataArray;

// --- 1. BUILD THE METERS IMMEDIATELY ---
function buildMeters() {
    meterContainer.innerHTML = ''; // Clear it out first
    for(let i=0; i<30; i++) {
        const s = document.createElement('div');
        s.className = 'seg';
        meterContainer.appendChild(s);
    }
}
buildMeters(); // Run this right away
const segs = document.querySelectorAll('.seg');

// --- 2. THE TAPE ENGINE ---
function initTapeEngine() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    source = audioCtx.createMediaElementSource(audio);
    
    // Analyser for the dancing lights
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; 
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Tape Effects
    const saturator = audioCtx.createWaveShaper();
    const shelf = audioCtx.createBiquadFilter();
    const wobble = audioCtx.createDelay();
    hissGain = audioCtx.createGain();
    mainGain = audioCtx.createGain();

    // Wow & Flutter (Speed Wobble)
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.4; 
    lfoGain.gain.value = 0.0006; 
    lfo.connect(lfoGain);
    lfoGain.connect(wobble.delayTime);
    lfo.start();

    // Warmth Curve
    saturator.curve = (function(amount) {
        let n = 44100, curve = new Float32Array(n), x;
        for (let i = 0; i < n; ++i ) {
            x = i * 2 / n - 1;
            curve[i] = (3 + amount) * x * 20 * (Math.PI / 180) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    })(40);

    // Tape Hiss
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
    hissGain.gain.value = 0.015; // The "Hiss" volume

    // Analog Roll-off (Muffled Highs)
    shelf.type = "highshelf";
    shelf.frequency.value = 11000;
    shelf.gain.value = -5;

    // Routing
    source.connect(wobble);
    wobble.connect(saturator);
    saturator.connect(shelf);
    shelf.connect(analyser);
    analyser.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    whiteNoise.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    whiteNoise.start();
    draw(); // Start the animation loop
}

// --- 3. ANIMATION LOOP ---
function draw() {
    requestAnimationFrame(draw);
    
    if (!analyser || audio.paused) {
        segs.forEach(s => s.classList.remove('on-green', 'on-red'));
        return;
    }

    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for(let i=0;
