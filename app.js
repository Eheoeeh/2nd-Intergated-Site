/**
  Aura Ambient Workspace Engine - Snapped Vertical 3D Animation Edition
  Employs modern JS patterns: AbortController, requestAnimationFrame,
  Web Audio API Analyser, Canvas, IntersectionObserver, and 3D Tilt calculation.
**/

document.addEventListener('DOMContentLoaded', () => {
  // Setup AbortController for clean event handling
  const controller = new AbortController();
  const { signal } = controller;

  // State Management
  const state = {
    themeHue: 315,
    waveFreq: 0.02,
    waveAmp: 30,
    waveSpeed: 0.015,
    waveLayers: 2,
    waveMode: 'sine',
    isAudioPlaying: false,
    audioCtx: null,
    audioNodes: null
  };

  // DOM Cache
  const root = document.documentElement;
  const consoleHistory = document.getElementById('console-history');
  const consoleInput = document.getElementById('console-input');
  const themePreset = document.getElementById('theme-preset');
  const statusAnchor = document.getElementById('status-anchor');
  const detailDialog = document.getElementById('detail-dialog');
  const closeDialogBtn = document.getElementById('btn-close-dialog');
  const closeDialogConfirmBtn = document.getElementById('btn-dialog-confirm');
  const statusBadge = document.getElementById('anchored-status-badge');

  // Session check and DOM updates
  const hudAuthBtn = document.getElementById('btn-hud-auth');
  const navAuthLink = document.getElementById('nav-hud-auth-link');
  const sessionData = localStorage.getItem('aura_session');
  
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      [hudAuthBtn, navAuthLink].forEach(btn => {
        if (btn) {
          btn.innerText = 'Sign Out';
          btn.removeAttribute('href');
          btn.style.cursor = 'pointer';
          btn.addEventListener('click', () => {
            localStorage.removeItem('aura_session');
            window.location.reload();
          }, { signal });
        }
      });
      // Print session verification on terminal launch
      setTimeout(() => {
        const identifier = session.username || session.name || session.email;
        logToTerminal(`Workspace session restored: <span class="console-highlight">${identifier}</span>`, 'system');
      }, 300);
    } catch (err) {
      console.error("Session recovery error:", err);
    }
  }

  // Dynamic status badge fallback support (Modern Web Guidance best practice)
  function checkAnchorPositioningSupport() {
    const supportsAnchor = CSS.supports('anchor-name: --test') || CSS.supports('position-anchor: --test');
    if (!supportsAnchor) {
      const updatePosition = () => {
        if (!statusAnchor || !statusBadge) return;
        const rect = statusAnchor.getBoundingClientRect();
        statusBadge.style.position = 'fixed';
        statusBadge.style.left = `${rect.right + 12}px`;
        statusBadge.style.top = `${rect.top + rect.height/2}px`;
        statusBadge.style.transform = 'translateY(-50%)';
        statusBadge.style.margin = '0';
      };

      window.addEventListener('resize', updatePosition, { signal });
      window.addEventListener('scroll', updatePosition, { signal });
      setTimeout(updatePosition, 100);
    }
  }
  checkAnchorPositioningSupport();

  // ----------------------------------------------------
  // SECTION 1: Intersection Observer (Scroll Snapping HUD Sync)
  // ----------------------------------------------------
  const sections = document.querySelectorAll('.viewport-section');
  const navLinks = document.querySelectorAll('.nav-link');

  const observerOptions = {
    root: null, // Viewport
    threshold: 0.55 // Trigger when more than half is visible
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Toggle active class on section (triggers CSS 3D fade-up)
        sections.forEach(s => s.classList.remove('active'));
        entry.target.classList.add('active');

        // Synchronize Nav Links
        const targetId = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${targetId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });

        // Toggle HUD compact morphing on scroll
        if (targetId === 'section-intro') {
          document.body.classList.remove('hud-compact');
        } else {
          document.body.classList.add('hud-compact');
        }
      }
    });
  }, observerOptions);

  sections.forEach(section => sectionObserver.observe(section));


  // ----------------------------------------------------
  // SECTION 2: 3D Mouse Tilt Animation on Cards
  // ----------------------------------------------------
  const tiltTargets = document.querySelectorAll('.tilt-target');

  tiltTargets.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      
      // Calculate coordinates relative to card center
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Map to max rotation angle (e.g. ±12 degrees)
      const rotateX = -(y / (rect.height / 2)) * 12;
      const rotateY = (x / (rect.width / 2)) * 12;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.015)`;
    }, { signal });

    card.addEventListener('mouseleave', () => {
      card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
    }, { signal });
  });


  // ----------------------------------------------------
  // SECTION 3: Theme Color Setup
  // ----------------------------------------------------
  function updateThemeHue(hue) {
    const numericHue = parseInt(hue, 10);
    if (isNaN(numericHue) || numericHue < 0 || numericHue > 360) return false;
    
    state.themeHue = numericHue;
    root.style.setProperty('--theme-hue', numericHue);
    themePreset.value = numericHue.toString();
    return true;
  }

  themePreset.addEventListener('change', (e) => {
    updateThemeHue(e.target.value);
    logToTerminal(`System color preset updated to OKLCH Hue: ${e.target.value}°`, 'system');
  }, { signal });

  // Native Dialog Modal interactions
  statusAnchor.addEventListener('click', () => {
    detailDialog.showModal();
    logToTerminal("Workspace diagnostics dialog invoked.", "system");
  }, { signal });

  closeDialogBtn.addEventListener('click', () => {
    detailDialog.close();
  }, { signal });

  closeDialogConfirmBtn.addEventListener('click', () => {
    detailDialog.close();
    logToTerminal("System parameters confirmed.", "system");
  }, { signal });

  detailDialog.addEventListener('click', (e) => {
    const rect = detailDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
      && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      detailDialog.close();
    }
  }, { signal });


  // ----------------------------------------------------
  // SECTION 4: Command Console Logic
  // ----------------------------------------------------
  function logToTerminal(text, type = 'system') {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    
    if (type === 'system') {
      line.innerHTML = `[sys] ${text}`;
    } else if (type === 'user') {
      line.innerHTML = `<span class="console-prompt">&gt;</span> ${text}`;
    } else if (type === 'error') {
      line.innerHTML = `[err] ${text}`;
    }
    
    consoleHistory.appendChild(line);
    consoleHistory.scrollTop = consoleHistory.scrollHeight;
  }

  function handleConsoleCommand(inputVal) {
    const cleanInput = inputVal.trim();
    if (!cleanInput) return;

    logToTerminal(cleanInput, 'user');
    const tokens = cleanInput.split(/\s+/);
    const command = tokens[0].toLowerCase();

    switch (command) {
      case 'help':
        logToTerminal("Console controls:<br/>• <span class='console-highlight'>hue [0-360]</span> - Apply OKLCH base colors.<br/>• <span class='console-highlight'>wave [freq] [amp]</span> - Change Visual Wave oscillator values.<br/>• <span class='console-highlight'>status</span> - Report browser and UI thread logs.<br/>• <span class='console-highlight'>clear</span> - Wipes log logs.", "system");
        break;
      
      case 'clear':
        consoleHistory.innerHTML = '';
        break;

      case 'hue':
        if (tokens[1]) {
          const ok = updateThemeHue(tokens[1]);
          if (ok) {
            logToTerminal(`System color rotation successful.`, 'system');
          } else {
            logToTerminal("Error: Hue parameter must fall between 0 and 360.", 'error');
          }
        } else {
          logToTerminal("Syntax: hue [0-360]. Try 'hue 45'", 'error');
        }
        break;

      case 'wave':
        const newFreq = parseFloat(tokens[1]);
        const newAmp = parseFloat(tokens[2]);
        if (!isNaN(newFreq) && !isNaN(newAmp)) {
          state.waveFreq = newFreq;
          state.waveAmp = newAmp;
          
          document.getElementById('slider-freq').value = newFreq;
          document.getElementById('slider-amp').value = newAmp;
          document.getElementById('val-freq').innerText = newFreq.toFixed(3);
          document.getElementById('val-amp').innerText = newAmp;
          
          logToTerminal(`Visual Wave state calibrated.`, 'system');
        } else {
          logToTerminal("Syntax: wave [frequency] [amplitude]. Try 'wave 0.03 40'", 'error');
        }
        break;

      case 'status':
        const browser = navigator.userAgentData ? navigator.userAgentData.brands[0].brand : "Chromium Dev Engine";
        logToTerminal(`Diagnostics info:<br/>• Active Hue: ${state.themeHue}°<br/>• Local Audio context: ${state.isAudioPlaying ? 'Streaming' : 'Suspended'}<br/>• Render: requestAnimationFrame Pipeline<br/>• Engine Host: ${browser}`, 'system');
        break;

      default:
        logToTerminal(`Command not recognized: '${command}'. Type 'help' for guidance.`, 'error');
    }
  }

  consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleConsoleCommand(consoleInput.value);
      consoleInput.value = '';
    }
  }, { signal });


  // ----------------------------------------------------
  // SECTION 5: Fluid Wave Canvas Engine (Module 1)
  // ----------------------------------------------------
  const canvas = document.getElementById('wave-canvas');
  const ctx = canvas.getContext('2d');
  
  const sliderFreq = document.getElementById('slider-freq');
  const sliderAmp = document.getElementById('slider-amp');
  const sliderSpeed = document.getElementById('slider-speed');
  const sliderLayers = document.getElementById('slider-layers');

  const valFreq = document.getElementById('val-freq');
  const valAmp = document.getElementById('val-amp');
  const valSpeed = document.getElementById('val-speed');
  const valLayers = document.getElementById('val-layers');

  let increment = 0;

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  window.addEventListener('resize', resizeCanvas, { signal });
  resizeCanvas();

  function animateWave() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const hueVal = state.themeHue;
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    const yCenter = h / 2;

    // Render overlapping waves with phase offsets for high-fidelity moire
    for (let layer = 0; layer < state.waveLayers; layer++) {
      const opacity = 1 - (layer * 0.22);
      ctx.strokeStyle = `oklch(76% 0.12 ${hueVal} / ${opacity})`;
      ctx.lineWidth = 4 - (layer * 0.8);
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(0, yCenter);

      const phaseOffset = layer * (Math.PI / 3.5) + increment;

      for (let i = 0; i < w; i++) {
        let y = yCenter;
        const xOffset = i * state.waveFreq;
        
        if (state.waveMode === 'sine') {
          y += Math.sin(xOffset + phaseOffset) * state.waveAmp * Math.sin(increment * 0.35 + layer);
        } else if (state.waveMode === 'interference') {
          const w1 = Math.sin(xOffset + phaseOffset);
          const w2 = Math.cos(xOffset * 0.7 - phaseOffset * 1.3);
          y += (w1 + w2) * 0.55 * state.waveAmp;
        } else if (state.waveMode === 'chaotic') {
          y += (
            Math.sin(xOffset + phaseOffset) * 0.6 +
            Math.sin(xOffset * 2.2 + phaseOffset * 1.5) * 0.3 +
            Math.cos(xOffset * 4.1 - phaseOffset * 0.8) * 0.1
          ) * state.waveAmp * 1.25;
        }
        
        ctx.lineTo(i, y);
      }
      ctx.stroke();

      if (layer === 0) {
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.fillStyle = `oklch(96% 0.025 ${hueVal} / 0.12)`;
        ctx.fill();
      }
    }

    increment += state.waveSpeed;
    requestAnimationFrame(animateWave);
  }

  // Handle segmented mode buttons
  const segmentBtns = document.querySelectorAll('.btn-segment');
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.waveMode = e.target.dataset.mode;
      logToTerminal(`Wave formulation changed to: <span class="console-highlight">${state.waveMode}</span>`, 'system');
    }, { signal });
  });

  sliderFreq.addEventListener('input', (e) => {
    state.waveFreq = parseFloat(e.target.value);
    valFreq.innerText = state.waveFreq.toFixed(3);
  }, { signal });

  sliderAmp.addEventListener('input', (e) => {
    state.waveAmp = parseInt(e.target.value, 10);
    valAmp.innerText = state.waveAmp;
  }, { signal });

  sliderSpeed.addEventListener('input', (e) => {
    state.waveSpeed = parseFloat(e.target.value);
    valSpeed.innerText = state.waveSpeed.toFixed(3);
  }, { signal });

  sliderLayers.addEventListener('input', (e) => {
    state.waveLayers = parseInt(e.target.value, 10);
    valLayers.innerText = state.waveLayers;
  }, { signal });

  requestAnimationFrame(animateWave);


  // ----------------------------------------------------
  // SECTION 6: Simulated Local AI Assistant (Module 2)
  // ----------------------------------------------------
  const aiInput = document.getElementById('ai-input');
  const btnSummarize = document.getElementById('btn-ai-summarize');
  const btnClear = document.getElementById('btn-ai-clear');
  const aiOutput = document.getElementById('ai-output');
  const aiOutputText = document.getElementById('ai-output-text');

  btnSummarize.addEventListener('click', () => {
    const text = aiInput.value.trim();
    if (!text) {
      logToTerminal("Summarize invoked with empty input.", "error");
      return;
    }

    btnSummarize.disabled = true;
    btnSummarize.innerText = "Processing context...";
    logToTerminal("Calling on-device model.summarize() API simulation...", "system");

    setTimeout(() => {
      aiOutput.style.display = 'block';
      
      const mockPoints = [
        "Identified core modular configurations and interactive structures.",
        "Verified proper integration parameters across standard inputs.",
        "Optimized frame-rate scheduling for the canvas layout threads."
      ];
      
      aiOutputText.innerHTML = `<ul>${mockPoints.map(pt => `<li>${pt}</li>`).join('')}</ul>`;
      btnSummarize.disabled = false;
      btnSummarize.innerText = "Summarize Text";
      logToTerminal("Model resolution succeeded.", "system");
    }, 1100);
  }, { signal });

  btnClear.addEventListener('click', () => {
    aiInput.value = '';
    aiOutput.style.display = 'none';
    aiOutputText.innerHTML = '';
  }, { signal });


  // ----------------------------------------------------
  // SECTION 7: Container Query Architect (Module 3)
  // ----------------------------------------------------
  const architectWidthSlider = document.getElementById('slider-architect-width');
  const architectWidthVal = document.getElementById('architect-width-val');
  const architectBox = document.getElementById('architect-box');

  architectWidthSlider.addEventListener('input', (e) => {
    const pxValue = e.target.value;
    architectBox.style.width = `${pxValue}px`;
    architectWidthVal.innerText = `${pxValue}px`;
  }, { signal });


  // ----------------------------------------------------
  // SECTION 8: Web Audio Soundscape & Realtime Visualizer (Module 4)
  // ----------------------------------------------------
  const btnAudioToggle = document.getElementById('btn-audio-toggle');
  const sliderAudioFilter = document.getElementById('slider-audio-filter');
  const sliderAudioDepth = document.getElementById('slider-audio-depth');
  const visualizerCanvas = document.getElementById('audio-visualizer-canvas');
  const visualizerCtx = visualizerCanvas.getContext('2d');

  function resizeVisualizerCanvas() {
    if (!visualizerCanvas) return;
    const rect = visualizerCanvas.getBoundingClientRect();
    visualizerCanvas.width = rect.width * window.devicePixelRatio;
    visualizerCanvas.height = rect.height * window.devicePixelRatio;
  }
  window.addEventListener('resize', resizeVisualizerCanvas, { signal });
  resizeVisualizerCanvas();

  function initWebAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    
    // Noise buffer synthesis
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Filter Node
    const biquadFilter = ctx.createBiquadFilter();
    biquadFilter.type = 'lowpass';
    biquadFilter.frequency.value = parseFloat(sliderAudioFilter.value);

    // Dynamic Volume Gain
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);

    // Ambient LFO Modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = parseFloat(sliderAudioDepth.value) * 0.1;

    // Web Audio Analyser Node (For real-time canvas visualizer)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    // Node connections
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    noiseSource.connect(biquadFilter);
    biquadFilter.connect(gainNode);
    gainNode.connect(analyser); // Feed into analyser
    analyser.connect(ctx.destination);

    // Launch Audio Graph
    noiseSource.start(0);
    lfo.start(0);

    state.audioCtx = ctx;
    state.audioNodes = { noiseSource, biquadFilter, gainNode, lfo, lfoGain, analyser };
  }

  // Draw Audio frequency visualization loop
  function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    
    const w = visualizerCanvas.width / window.devicePixelRatio;
    const h = visualizerCanvas.height / window.devicePixelRatio;
    
    // Clear canvas
    visualizerCtx.clearRect(0, 0, w, h);
    
    if (!state.isAudioPlaying || !state.audioNodes) {
      // Draw flat ambient line when idle
      visualizerCtx.strokeStyle = `oklch(82% 0.05 var(--theme-hue) / 0.3)`;
      visualizerCtx.lineWidth = 2;
      visualizerCtx.beginPath();
      visualizerCtx.moveTo(0, h/2);
      visualizerCtx.lineTo(w, h/2);
      visualizerCtx.stroke();
      return;
    }

    const analyser = state.audioNodes.analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const barWidth = (w / bufferLength) * 1.5;
    let barHeight;
    let x = 0;

    visualizerCtx.lineWidth = 2.5;
    
    // Draw visual spectrum bars
    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * h * 0.85;
      
      const opacity = 0.15 + (barHeight / h) * 0.7;
      visualizerCtx.fillStyle = `oklch(76% 0.14 ${state.themeHue} / ${opacity})`;
      
      // Draw symmetrical bars centered vertically
      visualizerCtx.fillRect(x, (h - barHeight) / 2, barWidth - 2, barHeight);
      x += barWidth;
    }
  }

  btnAudioToggle.addEventListener('click', () => {
    if (!state.isAudioPlaying) {
      if (!state.audioCtx) {
        initWebAudio();
      } else {
        state.audioCtx.resume();
      }
      state.isAudioPlaying = true;
      btnAudioToggle.classList.add('playing');
      btnAudioToggle.innerHTML = '<span class="play-icon">■</span> Pause Ambient Flow';
      logToTerminal("Web Audio visualizer activated.", "system");
      document.getElementById('val-metric-status').innerText = "Streaming";
    } else {
      if (state.audioCtx) {
        state.audioCtx.suspend();
      }
      state.isAudioPlaying = false;
      btnAudioToggle.classList.remove('playing');
      btnAudioToggle.innerHTML = '<span class="play-icon">▶</span> Play Ambient Flow';
      logToTerminal("Web Audio stream suspended.", "system");
      document.getElementById('val-metric-status').innerText = "Suspended";
    }
  }, { signal });

  sliderAudioFilter.addEventListener('input', (e) => {
    if (state.audioNodes) {
      state.audioNodes.biquadFilter.frequency.setValueAtTime(parseFloat(e.target.value), state.audioCtx.currentTime);
    }
  }, { signal });

  sliderAudioDepth.addEventListener('input', (e) => {
    if (state.audioNodes) {
      state.audioNodes.lfoGain.gain.setValueAtTime(parseFloat(e.target.value) * 0.1, state.audioCtx.currentTime);
    }
  }, { signal });

  // Initiate Visualizer Drawing loop
  drawVisualizer();
});
