const audio = document.getElementById('audioEngine');
    const timer = document.getElementById('timer');
    const fileInput = document.getElementById('fileInput');
    const meter = document.getElementById('meter');
    const spindles = document.querySelectorAll('.spindle');

    // --- Web Audio API Setup ---
    let audioCtx;
    let source;
    let hissNode;
    let gainNode;
    let saturator;

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
        
        const hissGain = audioCtx.createGain();
        hissGain.gain.value = 0.005; // Adjusted for subtle "background" hiss

        const hissFilter = audioCtx.createBiquadFilter();
        hissFilter.type = "lowpass";
        hissFilter.frequency.value = 8000; // Soften the hiss

        // 3. Create "Warmth" (Saturator/Waveshaper)
        saturator = audioCtx.createWaveShaper();
        saturator.curve = makeDistortionCurve(5); // Subtle saturation
        saturator.oversample = '4x';

        // 4. Analog Roll-off (High shelf)
        const shelf = audioCtx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 12000;
        shelf.gain.value = -3; // Slight dip in ultra-highs

        gainNode = audioCtx.createGain();

        // Wiring the Rack:
        // Hiss Path
        hissNode.connect(hissFilter);
        hissFilter.connect(hissGain);
        hissGain.connect(audioCtx.destination);
        
        // Music Path
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

    // --- Original Logic Enhanced ---

    // Setup V-Meter
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
        if(id === 'door1' || id === 'door2') pauseAudio();
    }

    async function playAudio() {
    if(audio.src) {
        if (!audioCtx) initAudioContext();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        audio.volume = 0; // ADD THIS LINE: Mutes the raw MP3 so you only hear the 'Tape'
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
        else audio.volume = val; 
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
                seg.className = 'seg';
                if(i < level) {
                    seg.classList.add(i > 24 ? 'on-red' : 'on-green');
                }
            });
        }
    };

    audio.onended = () => spindles.forEach(s => s.classList.remove('spinning'));
