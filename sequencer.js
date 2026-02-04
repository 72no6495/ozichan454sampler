class Sequencer {
    constructor(audioEngine, updateUiCallback) {
        this.audioEngine = audioEngine;
        this.updateUiCallback = updateUiCallback;
        
        this.tracks = []; // Array of { sampleId: string, steps: Object }
        this.stepsCount = 16; // Standard 16-step sequencer
        this.currentStep = 0;
        this.isPlaying = false;
        
        // Tone.js Transport setup
        this.eventId = null;
    }

    init() {
        Tone.Transport.bpm.value = 120;
        
        // Schedule the loop
        this.eventId = Tone.Transport.scheduleRepeat((time) => {
            this.step(time);
        }, "16n");
    }

    // Add a track linked to a sample
    addTrack(sampleId) {
        this.tracks.push({
            sampleId: sampleId,
            steps: {} // key: stepIndex (0-15), value: { pitch: 0, velocity: 1 }
        });
        return this.tracks.length - 1; // Return track index
    }
    
    // Remove a track
    removeTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.tracks.splice(index, 1);
        }
    }

    getTrack(index) {
        return this.tracks[index];
    }

    // Toggle a step on/off
    toggleStep(trackIndex, stepIndex) {
        const track = this.tracks[trackIndex];
        if (!track) return;

        if (track.steps[stepIndex]) {
            delete track.steps[stepIndex];
        } else {
            track.steps[stepIndex] = { pitch: 0, velocity: 1 };
        }
    }

    // Set step pitch
    setStepPitch(trackIndex, stepIndex, pitch) {
        const track = this.tracks[trackIndex];
        if (track && track.steps[stepIndex]) {
            track.steps[stepIndex].pitch = pitch;
        }
    }

    // The main loop function called by Tone.Transport
    step(time) {
        // Draw step on UI (using Draw for syncing with visual frame)
        Tone.Draw.schedule(() => {
            if (this.updateUiCallback) {
                this.updateUiCallback(this.currentStep);
            }
        }, time);

        // Trigger sounds for current step
        this.tracks.forEach(track => {
            const stepData = track.steps[this.currentStep];
            if (stepData) {
                this.audioEngine.playScheduled(track.sampleId, time, stepData.pitch);
            }
        });

        // Advance step
        this.currentStep = (this.currentStep + 1) % this.stepsCount;
    }

    start() {
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }
        this.currentStep = 0;
        Tone.Transport.start();
        this.isPlaying = true;
    }

    stop() {
        Tone.Transport.stop();
        this.currentStep = 0;
        this.isPlaying = false;
        
        // Reset UI immediately
        if (this.updateUiCallback) {
            this.updateUiCallback(-1); // -1 indicates stopped/reset
        }
    }

    setBpm(bpm) {
        Tone.Transport.bpm.value = bpm;
    }

    clearAll() {
        this.tracks.forEach(track => {
            track.steps = {};
        });
    }
}
