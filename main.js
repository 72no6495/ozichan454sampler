// Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Subsystems
    const audioEngine = new AudioEngine();
    
    // UI update callback for sequencer
    const sequencer = new Sequencer(audioEngine, (stepIndex) => {
        ui.highlightStep(stepIndex);
    });
    
    const ui = new UIManager(audioEngine, sequencer);

    // Global App Interface for Inline HTML Event Handlers
    window.app = {
        toggleStep: (t, s) => {
            sequencer.toggleStep(t, s);
            ui.renderSequencer();
        },
        changeStepPitch: (t, s, delta) => {
            const track = sequencer.getTrack(t);
            if (track && track.steps[s]) {
                let newPitch = track.steps[s].pitch + delta;
                // Clamp pitch mostly for sanity (-24 to +24 semitones)
                newPitch = Math.max(-24, Math.min(24, newPitch));
                sequencer.setStepPitch(t, s, newPitch);
                ui.renderSequencer();
            }
        },
        removeTrack: (t) => {
            if(confirm('このトラックを削除しますか？')) {
                sequencer.removeTrack(t);
                ui.renderSequencer();
            }
        }
    };

    // --- Event Listeners ---

    // 1. Audio Context Start (User Interaction Requirement)
    const btnStartAudio = document.getElementById('btn-start-audio');
    const startOverlay = document.getElementById('start-overlay');
    
    btnStartAudio.addEventListener('click', async () => {
        await audioEngine.init();
        sequencer.init();
        startOverlay.classList.add('hidden');
        
        // Add one default slot
        audioEngine.addEmptySlot();
        ui.renderSampleList();
        ui.selectSlot('slot-1');
    });

    // 2. Mode Switching
    const btnModeEdit = document.getElementById('mode-edit');
    const btnModePerform = document.getElementById('mode-perform');
    const viewEdit = document.getElementById('view-edit');
    const viewPerform = document.getElementById('view-perform');

    function switchMode(mode) {
        if (mode === 'edit') {
            btnModeEdit.classList.add('active');
            btnModePerform.classList.remove('active');
            viewEdit.classList.remove('hidden');
            viewEdit.classList.add('flex'); // Restore flex
            viewPerform.classList.add('hidden');
            viewPerform.classList.remove('flex');
            
            // Re-draw waveform just in case size changed
            if (ui.selectedSlotId) ui.drawWaveform(ui.selectedSlotId);

        } else {
            btnModePerform.classList.add('active');
            btnModeEdit.classList.remove('active');
            viewPerform.classList.remove('hidden');
            viewPerform.classList.add('flex');
            viewEdit.classList.add('hidden');
            viewEdit.classList.remove('flex');
            
            ui.renderSequencer();
        }
    }

    btnModeEdit.addEventListener('click', () => switchMode('edit'));
    btnModePerform.addEventListener('click', () => switchMode('perform'));

    // 3. Transport Controls
    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const btnClear = document.getElementById('btn-clear');
    const inputBpm = document.getElementById('bpm-input');

    btnPlay.addEventListener('click', () => {
        if (!sequencer.isPlaying) {
            sequencer.start();
            btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            btnPlay.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
            btnPlay.classList.remove('bg-green-600', 'hover:bg-green-500');
        } else {
            // Pause behavior (actually stop transport but keep position logic if needed, but here simple toggle)
            sequencer.stop();
            btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            btnPlay.classList.remove('bg-yellow-600', 'hover:bg-yellow-500');
            btnPlay.classList.add('bg-green-600', 'hover:bg-green-500');
        }
    });

    btnStop.addEventListener('click', () => {
        sequencer.stop();
        btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        btnPlay.classList.remove('bg-yellow-600', 'hover:bg-yellow-500');
        btnPlay.classList.add('bg-green-600', 'hover:bg-green-500');
    });

    btnClear.addEventListener('click', () => {
        if(confirm('すべてのシーケンスデータを消去しますか？')) {
            sequencer.clearAll();
            ui.renderSequencer();
        }
    });

    inputBpm.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (val < 40) val = 40;
        if (val > 300) val = 300;
        e.target.value = val;
        sequencer.setBpm(val);
    });

    // 4. Sample Management
    const btnAddSample = document.getElementById('btn-add-sample');
    const btnLoadEmpty = document.getElementById('btn-load-empty');
    
    // Empty state load button
    btnLoadEmpty.addEventListener('click', () => {
        if (ui.selectedSlotId) {
            fileInput.click();
        } else {
            // If no slot selected (rare case in empty state logic but possible), add one then click
            const id = audioEngine.addEmptySlot();
            ui.renderSampleList();
            ui.selectSlot(id);
            // Wait for UI update
            setTimeout(() => fileInput.click(), 50);
        }
    });

    btnAddSample.addEventListener('click', () => {
        const id = audioEngine.addEmptySlot();
        ui.renderSampleList();
        ui.selectSlot(id);
    });

    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0 && ui.selectedSlotId) {
            const file = e.target.files[0];
            
            // We need to replace the content of the selected slot
            // Actually AudioEngine.addSample creates a NEW slot in current logic
            // Let's refactor AudioEngine slightly or handle it here.
            // Simpler: Just update the current slot in the map.
            
            // Wait, AudioEngine.addSample returns a promise with ID. 
            // We should modify AudioEngine to allow "loading into existing slot" or just swap data.
            // For now, let's just use the logic: Load file -> Update AudioEngine Map -> Update UI
            
            try {
                // Reuse logic from AudioEngine but targeting specific ID?
                // Or just delete old and add new? 
                // Let's implement a 'loadIntoSlot' in main for now using AudioEngine internals if possible, 
                // but cleaner is to add method to Engine.
                // Let's do it manually here for speed:
                
                const url = URL.createObjectURL(file);
                const buffer = new Tone.ToneAudioBuffer(url, () => {
                    const sample = audioEngine.getSample(ui.selectedSlotId);
                    if (sample) {
                        sample.player = new Tone.Player(buffer).connect(audioEngine.masterVolume);
                        sample.buffer = buffer;
                        sample.params.name = file.name;
                        sample.params.duration = buffer.duration;
                        
                        // Reset params
                        sample.params.startOffset = 0;
                        sample.params.endPoint = 1;
                        
                        console.log(`Loaded ${file.name} into ${ui.selectedSlotId}`);
                        ui.updateEditorValues(sample);
                        ui.renderSampleList();
                        ui.drawWaveform(ui.selectedSlotId);
                    }
                });
                
            } catch (err) {
                console.error(err);
                alert('読み込みに失敗しました');
            }
        }
        // Reset input
        fileInput.value = '';
    });

    const btnPreview = document.getElementById('btn-preview');
    btnPreview.addEventListener('click', () => {
        if (ui.selectedSlotId) {
            audioEngine.play(ui.selectedSlotId);
        }
    });

    // 5. Editor Parameter Controls
    const bindParam = (input, key) => {
        input.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (ui.selectedSlotId) {
                audioEngine.updateParam(ui.selectedSlotId, key, val);
                
                // Update UI text immediately
                const sample = audioEngine.getSample(ui.selectedSlotId);
                ui.updateEditorValues(sample);
                
                // Redraw for trim params
                if (key === 'startOffset' || key === 'endPoint') {
                    ui.drawWaveform(ui.selectedSlotId);
                }
            }
        });
    };

    bindParam(document.getElementById('param-volume'), 'volume');
    bindParam(document.getElementById('param-rate'), 'playbackRate');
    bindParam(document.getElementById('param-start'), 'startOffset');
    bindParam(document.getElementById('param-end'), 'endPoint');

    // 6. Add Track (Performance Mode)
    const btnAddTrack = document.getElementById('add-track-btn');
    btnAddTrack.addEventListener('click', () => {
        // Show a simple modal or prompt to choose which sample to add
        // For simplicity, let's just add the currently selected sample from Edit mode
        // Or if none selected, prompt user.
        
        // Better UX: Dropdown? 
        // Let's just default to "Last Selected" or "Slot 1".
        
        const samples = audioEngine.getAllSamples();
        const validSamples = samples.filter(s => s.hasAudio);
        
        if (validSamples.length === 0) {
            alert('有効なサンプルがありません。編集モードで音声ファイルを読み込んでください。');
            return;
        }
        
        // Simple selection logic: if a slot is selected and has audio, use it.
        // Otherwise use the first valid one.
        let targetId = ui.selectedSlotId;
        const selectedSample = audioEngine.getSample(targetId);
        
        if (!selectedSample || !selectedSample.player) {
            targetId = validSamples[0].id;
        }
        
        sequencer.addTrack(targetId);
        ui.renderSequencer();
    });

});
