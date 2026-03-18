const audio = document.getElementById('audioEngine');
const timer = document.getElementById('timer');
const fileInput = document.getElementById('fileInput');
const spindles = document.querySelectorAll('.spindle');

let audioCtx, hissNode, hissGain;

// --- 1. SEPARATE HISS ENGINE ---
// This ONLY handles the noise, it doesn't touch your MP3 signal
function initHiss() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create Noise Buffer
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    
    hissNode = audioCtx.createBufferSource();
    hissNode.buffer = noiseBuffer;
    hissNode.loop = true;

    // Filter to make it sound like tape (muffled)
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 7000;

    hissGain = audioCtx.createGain();
    hissGain.gain.value = 0.012; // Start very low

    hissNode.connect(filter);
    filter.connect(hissGain);
    hissGain.connect(audioCtx.destination);
    
    hissNode.start();
}

// --- 2. CLEAN CONTROLS ---
async function playAudio() {
    if(audio.src) {
        // Start the hiss
        initHiss();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        // Play the MP3 normally (No processing = No distortion)
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
    // Standard volume control
    const v = document.getElementById('volume').value;
    audio.volume = v;
}

// --- 3. UTILITIES ---
fileInput.onchange = (e) => {
    audio.src = URL.createObjectURL(e.target.files[0]);
};

audio.ontimeupdate = () => {
    const m = Math.floor(audio.currentTime / 60);
    const s = Math.floor(audio.currentTime % 60);
    timer.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2
