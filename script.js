const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meterContainer = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, mainGain, analyser, dataArray, segs;

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

buildMeters();
window.onload = buildMeters;

async function initTapeEngine() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaElementSource(audio);
    
    // THE FIX: Mute the raw audio element so you don't hear a "double" distorted sound
    audio.volume = 0; 

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const saturator = audioCtx.createWaveShaper();
    const shelf = audioCtx.createBiquadFilter();
    const wobble = audioCtx.createDelay();
    hissGain = audioCtx.createGain();
    mainGain = audioCtx.createGain();

    // --- WOW & FLUTTER ---
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.45; 
    lfoGain.gain.value = 0.0006; 
    lfo.connect(lfoGain);
    lfoGain.connect(wobble.delayTime);
    lfo.start();

    // --- TAPE SATURATION FIX: Lowered from 55 to 5 to stop the crunch ---
    saturator.curve = (function(amount) {
        let n = 44100, curve = new Float32Array(n), x;
        for (let i = 0; i < n; ++i ) {
            x = i * 2 / n - 1;
            curve[i] = (3 + amount) * x * 20 * (Math.PI / 180) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    })(5); 

    // --- TAPE HISS ---
    const bufferSize = 3 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const noiseOutput = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { noiseOutput[i] = Math.random() * 2 - 1; }
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = "lowpass";
    hissFilter.frequency.value = 6000;
    hissGain.gain.value = 0.012; 

    // --- ANALOG SHELF ---
    shelf.type = "highshelf";
    shelf.frequency.value = 11000;
    shelf.gain.value = -4;

    // --- ROUTING ---
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
    drawMeter();
}

function drawMeter() {
    requestAnimationFrame(drawMeter);
    if (!analyser || audio.paused || !segs) return;
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for(let i = 0; i < 15; i++) { sum += dataArray[i]; }
    let level = Math.floor((sum / 15 / 140) * 30); 
    segs.forEach((seg, i) => {
        seg.className = 'seg' + (i < level ? (i > 23 ? ' on-red' : ' on-green') : '');
    });
}

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
    // Update the Engine gain, keep the raw audio element at 0 (muted)
    if (mainGain) mainGain.gain.value = v;
}

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        audio.src = URL.createObjectURL(e.target.files[0]);
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
