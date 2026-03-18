const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const meter = document.getElementById('meter');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, gainNode, saturator, dolbyOn = false;

// 1. Setup Visual Meter
for(let i=0; i<30; i++) {
    const s = document.createElement('div');
    s.className = 'seg';
    meter.appendChild(s);
}
const segs = document.querySelectorAll('.seg');

// 2. The Engine
async function initAudioContext() {
    if (audioCtx) return;
    
    // Create Context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // CHROMEBOOK FIX: Force the audio element to allow cross-origin data
    audio.crossOrigin = "anonymous";
    
    source = audioCtx.createMediaElementSource(audio);

    // Hiss Generation
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    
    const hissSource = audioCtx.createBufferSource();
    hissSource.buffer = noiseBuffer;
    hissSource.loop = true;
    
    hissGain = audioCtx.createGain();
    hissGain.gain.value = 0.005; 

    // Tape Effects
    saturator = audioCtx.createWaveShaper();
    saturator.curve = makeDistortionCurve(5);
    
    const shelf = audioCtx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 12000;
    shelf.gain.value = -1;

    gainNode = audioCtx.createGain();
    gainNode.gain.value = document.getElementById('volume').value;

    // Routing
    source.connect(saturator);
    saturator.connect(shelf);
    shelf.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    hissSource.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    hissSource.start();
}

function makeDistortionCurve(amount) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// 3. Controls
async function playAudio() {
    if (!audio.src) {
        alert("Load a file first!");
        return;
    }

    if (!audioCtx) await initAudioContext();
    
    // CHROMEBOOK FIX: Always resume context on play
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    // Use a very low volume for the raw tag to keep the engine alive 
    // without causing double-audio distortion
    audio.volume = 0.01; 
    
    audio.play().catch(err => {
        console.error("Playback blocked:", err);
        alert("Click the page first, then hit Play.");
    });

    spindles.forEach(s => s.classList.add('spinning'));
}

function pauseAudio() {
    audio.pause();
    spindles.forEach(s => s.classList.remove('spinning'));
}

function updateVol() {
    const val = document.getElementById('volume').value;
    if (gainNode) gainNode.gain.value = val;
}

function toggleDolby() {
    const btn = document.getElementById('dolbyBtn');
    if (!hissGain) return;
    dolbyOn = !dolbyOn;
    if (dolbyOn) {
        hissGain.gain.setTargetAtTime(0.001, audioCtx.currentTime, 0.1);
        btn.style.color = "var(--pioneer-gold)";
        btn.innerText = "DOLBY NR: ON";
    } else {
        hissGain.gain.setTargetAtTime(0.005, audioCtx.currentTime, 0.1);
        btn.style.color = "#888";
        btn.innerText = "DOLBY NR: OFF";
    }
}

fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        audio.src = URL.createObjectURL(file);
        // Reset spindles if a new tape is loaded
        spindles.forEach(s => s.classList.remove('spinning'));
    }
};

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

function rewind() { audio.currentTime -= 5; }
function forward() { audio.currentTime += 5; }
function toggleEject(id) { document.getElementById(id).classList.toggle('open'); pauseAudio(); }
