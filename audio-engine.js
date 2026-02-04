class AudioEngine {
    constructor() {
        this.samples = new Map(); // id -> { player: Tone.Player, buffer: Tone.ToneAudioBuffer, params: Object }
        this.nextId = 1;
        this.isInitialized = false;
        
        // Master Output with a Limiter to prevent clipping
        this.limiter = new Tone.Limiter(-1).toDestination();
        this.masterVolume = new Tone.Volume(0).connect(this.limiter);
    }

    async init() {
        if (!this.isInitialized) {
            await Tone.start();
            console.log("Audio Context Started");
            this.isInitialized = true;
        }
    }

    // Add a new sample from a File object
    async addSample(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const buffer = new Tone.ToneAudioBuffer(url, () => {
                const id = `slot-${this.nextId++}`;
                
                const player = new Tone.Player(buffer).connect(this.masterVolume);
                
                // Default params
                const params = {
                    name: file.name,
                    volume: 0,
                    playbackRate: 1,
                    startOffset: 0, // 0 to 1 (normalized)
                    endPoint: 1,    // 0 to 1 (normalized)
                    duration: buffer.duration
                };

                this.samples.set(id, { player, buffer, params });
                console.log(`Sample loaded: ${id}`);
                resolve(id);
            }, (err) => {
                console.error("Error loading sample", err);
                reject(err);
            });
        });
    }

    // Add an empty slot (placeholder)
    addEmptySlot() {
        const id = `slot-${this.nextId++}`;
        this.samples.set(id, { 
            player: null, 
            buffer: null, 
            params: { name: "Empty Slot", volume: 0, playbackRate: 1, startOffset: 0, endPoint: 1, duration: 0 } 
        });
        return id;
    }

    getSample(id) {
        return this.samples.get(id);
    }

    getAllSamples() {
        return Array.from(this.samples.entries()).map(([id, data]) => ({
            id,
            name: data.params.name,
            hasAudio: !!data.player
        }));
    }

    // Play a sample immediately (preview)
    play(id) {
        const sample = this.samples.get(id);
        if (sample && sample.player) {
            // Stop if already playing to allow re-trigger
            sample.player.stop();
            
            const duration = sample.buffer.duration;
            const startTime = sample.params.startOffset * duration;
            let playDuration = (sample.params.endPoint * duration) - startTime;
            
            if (playDuration <= 0) playDuration = 0.1; // Minimal duration safety

            sample.player.start(Tone.now(), startTime, playDuration);
        }
    }

    // Play a sample at a specific time (for sequencer)
    playScheduled(id, time, pitchShift = 0) {
        const sample = this.samples.get(id);
        if (sample && sample.player) {
            const duration = sample.buffer.duration;
            const startTime = sample.params.startOffset * duration;
            let playDuration = (sample.params.endPoint * duration) - startTime;
            
            if (playDuration <= 0) playDuration = 0.1;

            // Apply pitch shift by modifying playbackRate temporarily
            // We assume standard playbackRate is the base. 
            // 1 semitone = 2^(1/12) approx 1.05946
            const originalRate = sample.params.playbackRate;
            if (pitchShift !== 0) {
                const rateFactor = Math.pow(2, pitchShift / 12);
                sample.player.playbackRate = originalRate * rateFactor;
            } else {
                sample.player.playbackRate = originalRate;
            }

            sample.player.start(time, startTime, playDuration);
            
            // Reset rate after trigger (optional, depending on polyphony needs)
            // Tone.Player is monophonic by default unless re-triggered. 
            // For polyphony we might need Tone.Sampler or creating new sources, 
            // but for a simple drum machine/sampler, retriggering the single player is often okay 
            // or we accept that one slot = one voice.
        }
    }

    updateParam(id, key, value) {
        const sample = this.samples.get(id);
        if (!sample) return;

        // Update stored params
        sample.params[key] = value;

        // Apply realtime updates to player
        if (sample.player) {
            if (key === 'volume') {
                sample.player.volume.value = value;
            } else if (key === 'playbackRate') {
                sample.player.playbackRate = value;
            }
        }
    }

    // Extract waveform data for visualization
    getWaveformData(id, samples = 100) {
        const sample = this.samples.get(id);
        if (!sample || !sample.buffer) return null;

        const channelData = sample.buffer.getChannelData(0); // Left channel
        const blockSize = Math.floor(channelData.length / samples);
        const data = [];

        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[i * blockSize + j]);
            }
            data.push(sum / blockSize);
        }
        return data;
    }
}
