const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, source, hissGain, mainGain;

async function initTapeEngine() {
    if (audioCtx) return;

    // 1. Start the Audio Context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 2. Create the source
    source = audioCtx.createMediaElementSource(audio);
    
    // 3. THE FIX: Reduce the volume of the RAW audio element to 0
    // This stops the "Double Sound" that causes the distortion.
    // The Web Audio API will still get the signal, but the browser won't play the 'raw' version.
    audio.volume = 0; 

    // 4. Create a "Safe" Gain Node (The Pre-Amp)
    const safeGain = audioCtx.createGain();
    safeGain.gain.value = 0.5; // Start at 50% to be safe

    // 5. Tape Hiss (The Vibe)
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
    hissGain.gain.value = 0.01;

    // 6. Main Output
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.8;

    // 7. Connect it all
    // Source -> SafeGain -> MainGain -> Speakers
    source.connect(safeGain);
    safeGain.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // Hiss -> HissGain -> Speakers
    whiteNoise.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    whiteNoise.start();
}

// --- PLAYER CONTROLS ---
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
    // We update our Gain Node, NOT the audio.volume (keep that at 0!)
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
