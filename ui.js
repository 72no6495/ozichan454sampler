class UIManager {
    constructor(audioEngine, sequencer) {
        this.audioEngine = audioEngine;
        this.sequencer = sequencer;
        
        // Element References
        this.elements = {
            sampleSlotsContainer: document.getElementById('sample-slots-container'),
            editorControls: document.getElementById('editor-controls'),
            emptyState: document.getElementById('empty-state'),
            currentSampleName: document.getElementById('current-sample-name'),
            currentSlotBadge: document.getElementById('current-slot-badge'),
            waveformCanvas: document.getElementById('waveform-canvas'),
            sequencerTracks: document.getElementById('sequencer-tracks'),
            timelineHeader: document.getElementById('timeline-header'),
            
            // Inputs
            inputVolume: document.getElementById('param-volume'),
            inputRate: document.getElementById('param-rate'),
            inputStart: document.getElementById('param-start'),
            inputEnd: document.getElementById('param-end'),
            
            // Value Displays
            valVolume: document.getElementById('val-volume'),
            valRate: document.getElementById('val-rate'),
            valStart: document.getElementById('val-start'),
            valEnd: document.getElementById('val-end'),
        };

        this.selectedSlotId = null;
        this.selectedStep = null; // { trackIndex, stepIndex }
    }

    // --- Sample List & Editor ---

    renderSampleList() {
        const container = this.elements.sampleSlotsContainer;
        container.innerHTML = '';

        const samples = this.audioEngine.getAllSamples();
        
        samples.forEach((sample, index) => {
            const el = document.createElement('div');
            el.className = `p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 border-l-4 transition-all mb-2 ${
                this.selectedSlotId === sample.id ? 'border-blue-500 bg-gray-600' : 'border-transparent'
            }`;
            el.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="font-medium truncate text-sm text-gray-200">${sample.name}</div>
                    ${sample.hasAudio ? '<i class="fa-solid fa-wave-square text-xs text-blue-400"></i>' : '<i class="fa-solid fa-ban text-xs text-gray-500"></i>'}
                </div>
                <div class="text-xs text-gray-400 mt-1">Slot ${index + 1}</div>
            `;
            
            el.onclick = () => this.selectSlot(sample.id);
            container.appendChild(el);
        });
    }

    selectSlot(id) {
        this.selectedSlotId = id;
        this.renderSampleList();
        
        const sample = this.audioEngine.getSample(id);
        if (sample && sample.player) {
            this.elements.emptyState.classList.add('hidden');
            this.elements.editorControls.classList.remove('hidden');
            this.updateEditorValues(sample);
            this.drawWaveform(id);
        } else {
            this.elements.emptyState.classList.remove('hidden');
            this.elements.editorControls.classList.add('hidden');
        }
    }

    updateEditorValues(sample) {
        const p = sample.params;
        const e = this.elements;

        e.currentSampleName.textContent = p.name;
        e.currentSlotBadge.textContent = sample.id.toUpperCase();

        e.inputVolume.value = p.volume;
        e.valVolume.textContent = `${p.volume > 0 ? '+' : ''}${p.volume} dB`;

        e.inputRate.value = p.playbackRate;
        e.valRate.textContent = `${p.playbackRate.toFixed(1)}x`;

        e.inputStart.value = p.startOffset;
        e.valStart.textContent = `${(p.startOffset * p.duration).toFixed(2)}s`;

        e.inputEnd.value = p.endPoint;
        e.valEnd.textContent = `${(p.endPoint * p.duration).toFixed(2)}s`;
    }

    drawWaveform(id) {
        const canvas = this.elements.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;

        // Clear
        ctx.fillStyle = '#111827'; // gray-900
        ctx.fillRect(0, 0, width, height);

        const data = this.audioEngine.getWaveformData(id, width);
        if (!data) return;

        // Draw Wave
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa'; // blue-400
        ctx.lineWidth = 2;
        
        const middle = height / 2;
        const scale = height / 2;

        for (let i = 0; i < data.length; i++) {
            const x = i;
            const y = data[i] * scale;
            ctx.moveTo(x, middle - y);
            ctx.lineTo(x, middle + y);
        }
        ctx.stroke();

        // Draw Trim Region Overlay
        const sample = this.audioEngine.getSample(id);
        if (sample) {
            const startX = sample.params.startOffset * width;
            const endX = sample.params.endPoint * width;

            // Darken outside regions
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // Left side
            ctx.fillRect(0, 0, startX, height);
            // Right side
            ctx.fillRect(endX, 0, width - endX, height);

            // Lines
            ctx.fillStyle = '#3b82f6'; // blue-500
            ctx.fillRect(startX, 0, 2, height);
            ctx.fillRect(endX - 2, 0, 2, height);
        }
    }

    // --- Sequencer ---

    renderSequencer() {
        const tracksContainer = this.elements.sequencerTracks;
        const headerContainer = this.elements.timelineHeader;
        
        tracksContainer.innerHTML = '';
        headerContainer.innerHTML = '';

        if (this.sequencer.tracks.length === 0) {
            tracksContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                    <i class="fa-solid fa-music text-3xl mb-2"></i>
                    <p>トラックを追加してください</p>
                </div>`;
            return;
        }

        // Render Header Steps
        for (let i = 0; i < this.sequencer.stepsCount; i++) {
            const marker = document.createElement('div');
            marker.className = `flex-1 border-r border-gray-700 flex items-center justify-center text-xs text-gray-500 ${i % 4 === 0 ? 'bg-gray-800 font-bold text-gray-300' : ''}`;
            marker.textContent = i + 1;
            marker.id = `header-step-${i}`;
            headerContainer.appendChild(marker);
        }

        // Render Tracks
        this.sequencer.tracks.forEach((track, trackIndex) => {
            const sample = this.audioEngine.getSample(track.sampleId);
            const row = document.createElement('div');
            row.className = 'flex h-16 border-b border-gray-700 bg-gray-800';

            // Track Label
            const label = document.createElement('div');
            label.className = 'w-24 md:w-32 flex-shrink-0 bg-gray-800 border-r border-gray-700 p-2 flex flex-col justify-center relative z-10';
            label.innerHTML = `
                <div class="font-bold text-xs md:text-sm text-gray-300 truncate">${sample ? sample.params.name : 'Unknown'}</div>
                <div class="flex justify-between mt-1">
                    <button class="text-xs text-red-400 hover:text-red-300" onclick="window.app.removeTrack(${trackIndex})">
                        <i class="fa-solid fa-xmark"></i> <span class="hidden md:inline">削除</span>
                    </button>
                    <div class="text-xs text-blue-500 font-mono">TRK ${trackIndex + 1}</div>
                </div>
            `;
            row.appendChild(label);

            // Steps Area
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'flex-1 flex';
            
            for (let i = 0; i < this.sequencer.stepsCount; i++) {
                const stepBtn = document.createElement('div');
                const isActive = !!track.steps[i];
                const isBeat = i % 4 === 0;
                
                stepBtn.className = `flex-1 border-r border-gray-700 cursor-pointer transition-all relative group
                    ${isBeat ? 'bg-gray-750' : 'bg-transparent'}
                    hover:bg-gray-700
                `;
                stepBtn.dataset.step = i;
                stepBtn.dataset.track = trackIndex;
                stepBtn.id = `step-${trackIndex}-${i}`;

                // Step Content (Active Note)
                if (isActive) {
                    const pitch = track.steps[i].pitch;
                    stepBtn.innerHTML = `
                        <div class="absolute inset-1 bg-blue-500 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span class="text-xs font-bold text-white">${pitch > 0 ? '+' + pitch : pitch}</span>
                        </div>
                    `;
                }

                // Interactions
                stepBtn.addEventListener('mousedown', (e) => {
                    if (e.button === 0) { // Left Click
                        if (e.shiftKey && isActive) {
                            // Shift + Click: Increase pitch
                            window.app.changeStepPitch(trackIndex, i, 1);
                        } else if (e.ctrlKey && isActive) {
                            // Ctrl + Click: Decrease pitch
                            window.app.changeStepPitch(trackIndex, i, -1);
                        } else {
                            // Toggle
                            window.app.toggleStep(trackIndex, i);
                        }
                    } else if (e.button === 2) { // Right Click
                        e.preventDefault();
                        // Open simple prompt for pitch? Or just delete?
                        // For now: custom simple pitch cycle logic
                        // Let's make Right Click cycle pitch: 0 -> 2 -> 4 -> 5 -> 7 -> 12 -> 0
                        // window.app.cyclePitch(trackIndex, i);
                    }
                });

                // Context menu for pitch (Standard Right Click prevention)
                stepBtn.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (isActive) {
                         // Simple visual feedback could be added here
                         window.app.changeStepPitch(trackIndex, i, 1); // Simple increment on right click
                    }
                });

                stepsContainer.appendChild(stepBtn);
            }
            row.appendChild(stepsContainer);
            tracksContainer.appendChild(row);
        });
    }

    highlightStep(stepIndex) {
        // Reset all headers
        const headers = this.elements.timelineHeader.children;
        for (let h of headers) {
            h.classList.remove('bg-blue-600', 'text-white');
            if ((parseInt(h.textContent) - 1) % 4 === 0) {
                 h.classList.add('bg-gray-800');
            } else {
                 h.classList.remove('bg-gray-800');
            }
        }

        // Reset all steps opacity/highlight
        // (Optional: heavy DOM manipulation every 16th note might be slow on low-end devices, 
        // but for < 10 tracks it's fine. CSS based animation is better but harder to sync)
        
        if (stepIndex !== -1) {
            // Highlight Header
            const activeHeader = document.getElementById(`header-step-${stepIndex}`);
            if (activeHeader) {
                activeHeader.classList.remove('bg-gray-800');
                activeHeader.classList.add('bg-blue-600', 'text-white');
            }

            // Highlight Grid Column (Visual overlay could be better, but let's just leave it to header for now to save perf)
        }
    }
}
