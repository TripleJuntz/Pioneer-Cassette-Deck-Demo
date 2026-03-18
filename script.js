// 1. UPDATED INIT FUNCTION
function initAudioContext() {
    if (audioCtx) return;
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create Source from the <audio> tag
    source = audioCtx.createMediaElementSource(audio);

    // Hiss Engine
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
    
    hissNode = audioCtx.createBufferSource();
    hissNode.buffer = noiseBuffer;
    hissNode.loop = true;
    
    hissGain = audioCtx.createGain();
    hissGain.gain.value = 0.005; 

    // Warmth & Tone
    saturator = audioCtx.createWaveShaper();
    saturator.curve = makeDistortionCurve(5);
    
    const shelf = audioCtx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 12000;
    shelf.gain.value = -1; 

    gainNode = audioCtx.createGain();
    gainNode.gain.value = document.getElementById('volume').value;

    // --- THE FIX: ROUTING ---
    // Instead of connecting to audioCtx.destination directly, 
    // we chain them strictly: Source -> Saturator -> Shelf -> Gain -> Speakers
    source.connect(saturator);
    saturator.connect(shelf);
    shelf.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Hiss connects separately
    hissNode.connect(hissGain);
    hissGain.connect(audioCtx.destination);

    hissNode.start();
}

// 2. UPDATED PLAY FUNCTION
async function playAudio() {
    if(audio.src) {
        // Ensure context exists
        if (!audioCtx) initAudioContext();
        
        // Wake up the engine (Crucial for Chrome/Edge)
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        
        // Set volume to 1. Since 'source' is connected to the API, 
        // the API takes total control. If it's 0, nothing goes into the wires.
        audio.volume = 1; 
        
        audio.play().catch(e => console.error("Playback failed:", e));
        spindles.forEach(s => s.classList.add('spinning'));
    } else {
        alert("Load a file first!");
    }
}
