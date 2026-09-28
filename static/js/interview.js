/* ============================================================
   Virtual Mock Interview Studio - Real-time Engine
   WebRTC Video, Audio VU Meter, Speech Synthesis & Voice Dictation
============================================================ */

(function () {
  'use strict';

  // State
  let currentQuestionIndex = 0;
  const questions = window.questions || [];
  const answers = [];
  let userMediaStream = null;
  let audioContext = null;
  let analyser = null;
  let animFrameId = null;
  let micActive = true;
  let camActive = true;
  let aiVoiceActive = true;

  // Timers
  let questionSecondsRemaining = 180; // 3 minutes per question
  let questionTimerInterval = null;
  let sessionSecondsElapsed = 0;
  let sessionTimerInterval = null;

  // Speech Recognition & Synthesis
  let recognition = null;
  let isListening = false;
  let dictationRequested = false;
  let recognitionRestartTimer = null;
  let dictationText = '';
  let recognitionStartPending = false;
  const synth = window.speechSynthesis || null;

  // DOM Elements - Stages
  const lobbyStage = document.getElementById('lobbyStage');
  const interviewStage = document.getElementById('interviewStage');
  const scorecardStage = document.getElementById('scorecardStage');

  // DOM Elements - Lobby
  const lobbyVideo = document.getElementById('lobbyVideo');
  const videoFallback = document.getElementById('videoFallback');
  const cameraStatusBadge = document.getElementById('cameraStatusBadge');
  const lobbyVuFill = document.getElementById('lobbyVuFill');
  const lobbyMicStatus = document.getElementById('lobbyMicStatus');
  const toggleCamLobby = document.getElementById('toggleCamLobby');
  const toggleMicLobby = document.getElementById('toggleMicLobby');
  const requestCameraBtn = document.getElementById('requestCameraBtn');
  const startInterviewBtn = document.getElementById('startInterviewBtn');

  // DOM Elements - Studio
  const studioVideo = document.getElementById('studioVideo');
  const studioVideoFallback = document.getElementById('studioVideoFallback');
  const studioVuFill = document.getElementById('studioVuFill');
  const toggleCamStudio = document.getElementById('toggleCamStudio');
  const toggleMicStudio = document.getElementById('toggleMicStudio');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const leaveInterviewBtn = document.getElementById('leaveInterviewBtn');
  const questionTimer = document.getElementById('questionTimer');
  const sessionTimer = document.getElementById('sessionTimer');
  const aiAvatarCircle = document.getElementById('aiAvatarCircle');
  const aiStateBadge = document.getElementById('aiStateBadge');
  const aiSubtitle = document.getElementById('aiSubtitle');
  const hearQuestionBtn = document.getElementById('hearQuestionBtn');

  // DOM Elements - Question Workspace
  const questionIndexText = document.getElementById('questionIndexText');
  const questionCategoryText = document.getElementById('questionCategoryText');
  const questionDifficultyText = document.getElementById('questionDifficultyText');
  const questionWeightText = document.getElementById('questionWeightText');
  const studioProgressBar = document.getElementById('studioProgressBar');
  const studioQuestionHeading = document.getElementById('studioQuestionHeading');
  const studioAnswerArea = document.getElementById('studioAnswerArea');
  const voiceDictationBtn = document.getElementById('voiceDictationBtn');
  const voiceBtnLabel = document.getElementById('voiceBtnLabel');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const wordCountText = document.getElementById('wordCountText');
  const speakTimeText = document.getElementById('speakTimeText');
  const toggleHintBtn = document.getElementById('toggleHintBtn');
  const keywordHintBox = document.getElementById('keywordHintBox');
  const hintConceptsText = document.getElementById('hintConceptsText');
  const prevQuestionBtn = document.getElementById('prevQuestionBtn');
  const skipQuestionBtn = document.getElementById('skipQuestionBtn');
  const nextQuestionBtn = document.getElementById('nextQuestionBtn');
  const questionNavList = document.getElementById('questionNavList');
  const answeredCount = document.getElementById('answeredCount');
  const finishInterviewEarlyBtn = document.getElementById('finishInterviewEarlyBtn');

  // DOM Elements - Scorecard
  const heroScoreVal = document.getElementById('heroScoreVal');
  const heroGradePill = document.getElementById('heroGradePill');
  const heroHeadline = document.getElementById('heroHeadline');
  const heroSubtext = document.getElementById('heroSubtext');
  const metricTechnical = document.getElementById('metricTechnical');
  const fillTechnical = document.getElementById('fillTechnical');
  const metricCommunication = document.getElementById('metricCommunication');
  const fillCommunication = document.getElementById('fillCommunication');
  const metricAnswered = document.getElementById('metricAnswered');
  const fillAnswered = document.getElementById('fillAnswered');
  const reviewListContainer = document.getElementById('reviewListContainer');
  const retakeInterviewBtn = document.getElementById('retakeInterviewBtn');

  // ============================================================
  // 1. HARDWARE (CAMERA & MIC) INITIALIZATION
  // ============================================================
  async function attachStreamToVideo(targetVideoElement, targetFallback, stream) {
    if (!targetVideoElement) return false;

    targetVideoElement.srcObject = stream;
    targetVideoElement.muted = true;
    targetVideoElement.setAttribute('playsinline', '');

    const hasVideoFrame = () => (
      targetVideoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && targetVideoElement.videoWidth > 0
      && targetVideoElement.videoHeight > 0
    );

    if (!hasVideoFrame()) {
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 1500);
        targetVideoElement.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }

    try {
      await targetVideoElement.play();
    } catch (err) {
      console.warn('Camera preview could not start:', err);
    }

    const visible = hasVideoFrame();
    if (targetFallback) {
      targetFallback.style.display = visible ? 'none' : 'flex';
      if (!visible) {
        const message = targetFallback.querySelector('strong, p');
        if (message) message.textContent = 'Camera preview unavailable';
      }
    }
    return visible;
  }

  async function initMediaStream(targetVideoElement) {
    const targetFallback = targetVideoElement === studioVideo ? studioVideoFallback : videoFallback;

    try {
      if (userMediaStream) {
        await attachStreamToVideo(targetVideoElement, targetFallback, userMediaStream);
        return true;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showVideoFallback("Webcam not supported by this browser.", targetVideoElement);
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });

      userMediaStream = stream;
      const videoReady = await attachStreamToVideo(targetVideoElement, targetFallback, stream);
      if (cameraStatusBadge) {
        cameraStatusBadge.className = videoReady ? 'badge success' : 'badge warning';
        cameraStatusBadge.innerHTML = videoReady
          ? '<i class="fa-solid fa-circle-check"></i> Camera & Mic Ready'
          : '<i class="fa-solid fa-triangle-exclamation"></i> Camera Standby';
      }

      setupAudioVisualizer(stream);
      return true;
    } catch (err) {
      console.warn("Camera/Mic access denied or unavailable:", err);
      showVideoFallback("Camera permission denied. You can proceed with text & audio narration.", targetVideoElement);
      if (cameraStatusBadge) {
        cameraStatusBadge.className = 'badge warning';
        cameraStatusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Video Standby';
      }
      return false;
    }
  }

  function showVideoFallback(msg, targetVideoElement = lobbyVideo) {
    const targetFallback = targetVideoElement === studioVideo ? studioVideoFallback : videoFallback;
    if (targetFallback) {
      targetFallback.style.display = 'flex';
      const p = targetFallback.querySelector('p');
      if (p && msg) p.textContent = msg;
    }
  }

  function setupAudioVisualizer(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function updateVolume() {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const percent = Math.min(100, Math.round((average / 64) * 100));

        if (lobbyVuFill) lobbyVuFill.style.width = percent + '%';
        if (studioVuFill) studioVuFill.style.width = percent + '%';

        if (lobbyMicStatus) {
          if (percent > 15) {
            lobbyMicStatus.textContent = 'Voice detected: Good volume';
            lobbyMicStatus.style.color = 'var(--green)';
          } else {
            lobbyMicStatus.textContent = 'Speak to test microphone';
            lobbyMicStatus.style.color = '';
          }
        }

        animFrameId = requestAnimationFrame(updateVolume);
      }

      updateVolume();
    } catch (e) {
      console.warn("AudioContext visualizer error:", e);
    }
  }

  function toggleCamera() {
    camActive = !camActive;
    if (userMediaStream) {
      userMediaStream.getVideoTracks().forEach(track => { track.enabled = camActive; });
    }
    const btns = [toggleCamLobby, toggleCamStudio];
    btns.forEach(btn => {
      if (!btn) return;
      btn.classList.toggle('active', camActive);
      btn.innerHTML = camActive ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
    });
    if (studioVideoFallback) studioVideoFallback.style.display = camActive ? 'none' : 'flex';
    if (videoFallback) videoFallback.style.display = camActive ? 'none' : 'flex';
  }

  function toggleMicrophone() {
    micActive = !micActive;
    if (userMediaStream) {
      userMediaStream.getAudioTracks().forEach(track => { track.enabled = micActive; });
    }
    const btns = [toggleMicLobby, toggleMicStudio];
    btns.forEach(btn => {
      if (!btn) return;
      btn.classList.toggle('active', micActive);
      btn.innerHTML = micActive ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
    });
  }

  function releaseMediaStream() {
    if (!userMediaStream) return;
    userMediaStream.getTracks().forEach(track => track.stop());
    userMediaStream = null;
    if (lobbyVideo) lobbyVideo.srcObject = null;
    if (studioVideo) studioVideo.srcObject = null;
  }

  // ============================================================
  // 2. SPEECH SYNTHESIS (AI INTERVIEWER VOICE)
  // ============================================================
  function speakQuestion(text) {
    if (!synth || !aiVoiceActive) return;
    synth.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a good English voice
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David')));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => {
      if (aiAvatarCircle) aiAvatarCircle.classList.add('speaking');
      if (aiStateBadge) {
        aiStateBadge.className = 'ai-state-badge speaking';
        aiStateBadge.innerHTML = '<i class="fa-solid fa-volume-high"></i> Speaking...';
      }
      if (aiSubtitle) aiSubtitle.textContent = `"${text}"`;
    };

    utterance.onend = utterance.onerror = () => {
      if (aiAvatarCircle) aiAvatarCircle.classList.remove('speaking');
      if (aiStateBadge) {
        aiStateBadge.className = 'ai-state-badge';
        aiStateBadge.innerHTML = '<i class="fa-solid fa-waveform"></i> Listening...';
      }
    };

    synth.speak(utterance);
  }

  function toggleAiVoice() {
    aiVoiceActive = !aiVoiceActive;
    if (!aiVoiceActive && synth) synth.cancel();
    if (soundToggleBtn) {
      soundToggleBtn.innerHTML = aiVoiceActive
        ? '<i class="fa-solid fa-volume-high"></i> AI Voice: On'
        : '<i class="fa-solid fa-volume-xmark"></i> AI Voice: Muted';
      soundToggleBtn.classList.toggle('secondary', aiVoiceActive);
      soundToggleBtn.classList.toggle('ghost', !aiVoiceActive);
    }
  }

  // ============================================================
  // 3. SPEECH RECOGNITION (VOICE DICTATION FOR ANSWERS)
  // ============================================================
  function initSpeechRecognition() {
    if (/Electron/i.test(navigator.userAgent)) {
      if (voiceStatusText) {
        voiceStatusText.textContent = 'Voice dictation is unavailable in the VS Code preview. Open this page in Chrome or Edge.';
      }
      if (voiceDictationBtn) voiceDictationBtn.disabled = true;
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      if (voiceStatusText) voiceStatusText.textContent = "Voice dictation not supported on this browser (use text input).";
      if (voiceDictationBtn) voiceDictationBtn.disabled = true;
      return;
    }

    recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      recognitionStartPending = false;
      isListening = true;
      if (voiceDictationBtn) {
        voiceDictationBtn.classList.add('recording');
        voiceBtnLabel.textContent = "Stop Dictation";
      }
      if (voiceStatusText) {
        voiceStatusText.innerHTML = '<span class="recording-pulse"></span> Listening... speak your answer now';
      }
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        dictationText = `${dictationText} ${finalTranscript}`.trim();
      }

      if (studioAnswerArea) {
        const visibleText = `${dictationText} ${interimTranscript}`.trim();
        studioAnswerArea.value = visibleText;
        updateWordCount();
      }
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      recognitionStartPending = false;
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) {
        stopDictation();
        if (voiceStatusText) {
          voiceStatusText.textContent = e.error === 'network'
            ? 'Voice service is unavailable. Check your connection, then click Speak to retry.'
            : 'Microphone unavailable. Allow mic access, then click Speak to restart.';
        }
      } else if (e.error === 'no-speech' && voiceStatusText) {
        voiceStatusText.innerHTML = '<span class="recording-pulse"></span> No speech heard yet. Keep speaking...';
      }
    };

    recognition.onend = () => {
      isListening = false;
      if (!dictationRequested) return;

      clearTimeout(recognitionRestartTimer);
      recognitionRestartTimer = setTimeout(() => {
        if (!dictationRequested || isListening || recognitionStartPending) return;
        try {
          recognitionStartPending = true;
          recognition.start();
        } catch (err) {
          recognitionStartPending = false;
          console.warn("Error restarting dictation:", err);
        }
      }, 250);
    };
  }

  function toggleDictation() {
    if (!recognition) return;
    if (dictationRequested) {
      stopDictation();
    } else {
      dictationRequested = true;
      dictationText = studioAnswerArea ? studioAnswerArea.value.trim() : '';
      try {
        recognitionStartPending = true;
        recognition.start();
      } catch (err) {
        recognitionStartPending = false;
        dictationRequested = false;
        console.warn("Error starting dictation:", err);
        if (voiceStatusText) voiceStatusText.textContent = 'Could not start voice detection. Click Speak to try again.';
      }
    }
  }

  function stopDictation() {
    dictationRequested = false;
    clearTimeout(recognitionRestartTimer);
    isListening = false;
    recognitionStartPending = false;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    if (voiceDictationBtn) {
      voiceDictationBtn.classList.remove('recording');
      voiceBtnLabel.textContent = "Voice Dictation (Speak)";
    }
    if (voiceStatusText) {
      voiceStatusText.textContent = "Click to transcribe voice into text";
    }
  }

  // ============================================================
  // 4. TIMERS (PER-QUESTION & SESSION)
  // ============================================================
  function startQuestionTimer() {
    clearInterval(questionTimerInterval);
    questionSecondsRemaining = 180; // 3 mins per question
    updateQuestionTimerDisplay();

    questionTimerInterval = setInterval(() => {
      questionSecondsRemaining--;
      updateQuestionTimerDisplay();

      if (questionSecondsRemaining <= 0) {
        clearInterval(questionTimerInterval);
        // Prompt or move to next question automatically
        autoAdvanceOnTimeout();
      }
    }, 1000);
  }

  function updateQuestionTimerDisplay() {
    if (!questionTimer) return;
    const mins = Math.floor(questionSecondsRemaining / 60);
    const secs = questionSecondsRemaining % 60;
    questionTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (questionSecondsRemaining <= 30) {
      questionTimer.classList.add('urgent');
    } else {
      questionTimer.classList.remove('urgent');
    }
  }

  function startSessionTimer() {
    clearInterval(sessionTimerInterval);
    sessionSecondsElapsed = 0;
    sessionTimerInterval = setInterval(() => {
      sessionSecondsElapsed++;
      if (!sessionTimer) return;
      const mins = Math.floor(sessionSecondsElapsed / 60);
      const secs = sessionSecondsElapsed % 60;
      sessionTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  function autoAdvanceOnTimeout() {
    saveCurrentAnswer();
    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
      renderQuestion();
    } else {
      finishInterview();
    }
  }

  // ============================================================
  // 5. QUESTION RENDERING & NAVIGATION
  // ============================================================
  function renderQuestion() {
    stopDictation();
    const item = questions[currentQuestionIndex];
    if (!item) return;

    // Header info
    if (questionIndexText) questionIndexText.textContent = currentQuestionIndex + 1;
    if (questionCategoryText) questionCategoryText.textContent = item.category;
    if (questionDifficultyText) {
      questionDifficultyText.textContent = item.difficulty;
      questionDifficultyText.className = `pill-difficulty ${item.difficulty.toLowerCase()}`;
    }
    if (questionWeightText) {
      questionWeightText.innerHTML = `<i class="fa-solid fa-award"></i> Weight: ${item.weight || 10} pts`;
    }

    // Progress bar
    if (studioProgressBar) {
      const pct = ((currentQuestionIndex + 1) / questions.length) * 100;
      studioProgressBar.style.width = pct + '%';
    }

    // Question content
    if (studioQuestionHeading) studioQuestionHeading.textContent = item.question;
    if (hintConceptsText) hintConceptsText.textContent = (item.expected_concepts || '').replace(/\|/g, ' • ');
    if (keywordHintBox) keywordHintBox.classList.add('hidden');
    if (toggleHintBtn) toggleHintBtn.textContent = 'Show keywords hint';

    // Restore previous answer if any
    const prevAnswer = answers[currentQuestionIndex]?.answer || '';
    if (studioAnswerArea) studioAnswerArea.value = prevAnswer;
    updateWordCount();

    // Buttons
    if (prevQuestionBtn) prevQuestionBtn.disabled = currentQuestionIndex === 0;
    if (nextQuestionBtn) {
      if (currentQuestionIndex === questions.length - 1) {
        nextQuestionBtn.innerHTML = 'Finish Interview <i class="fa-solid fa-check"></i>';
        nextQuestionBtn.className = 'button primary finish-btn';
      } else {
        nextQuestionBtn.innerHTML = 'Save & Next <i class="fa-solid fa-arrow-right"></i>';
        nextQuestionBtn.className = 'button primary';
      }
    }

    // Update Drawer Roadmap
    updateDrawerRoadmap();

    // Reset question timer & speak question
    startQuestionTimer();
    speakQuestion(item.question);
  }

  function saveCurrentAnswer() {
    const item = questions[currentQuestionIndex];
    if (!item) return;
    const text = studioAnswerArea ? studioAnswerArea.value.trim() : '';
    answers[currentQuestionIndex] = {
      question: item,
      answer: text,
      answered: text.length > 0,
    };
    updateDrawerRoadmap();
  }

  function updateDrawerRoadmap() {
    if (!questionNavList) return;
    const items = questionNavList.querySelectorAll('.drawer-item');
    let count = 0;

    items.forEach((btn, idx) => {
      btn.classList.remove('active', 'completed', 'skipped');
      const icon = btn.querySelector('.status-icon');

      if (idx === currentQuestionIndex) {
        btn.classList.add('active');
        if (icon) icon.innerHTML = '<i class="fa-solid fa-circle-dot"></i>';
      } else if (answers[idx] && answers[idx].answered) {
        btn.classList.add('completed');
        if (icon) icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        count++;
      } else if (answers[idx] && !answers[idx].answered) {
        btn.classList.add('skipped');
        if (icon) icon.innerHTML = '<i class="fa-solid fa-circle-minus"></i>';
      } else {
        if (icon) icon.innerHTML = '<i class="fa-regular fa-circle"></i>';
      }
    });

    if (answeredCount) answeredCount.textContent = count;
  }

  function updateWordCount() {
    const text = studioAnswerArea ? studioAnswerArea.value.trim() : '';
    const words = text ? text.split(/\s+/).length : 0;
    if (wordCountText) wordCountText.textContent = `${words} words`;
    if (speakTimeText) {
      // average speaking speed ~130 words/min = 2.1 words/sec
      const sec = Math.round(words / 2.1);
      speakTimeText.textContent = `~${sec} sec speak time`;
    }
  }

  // ============================================================
  // 6. INTERVIEW SUBMISSION & SCORECARD GENERATION
  // ============================================================
  async function finishInterview() {
    saveCurrentAnswer();
    stopDictation();
    if (synth) synth.cancel();
    clearInterval(questionTimerInterval);
    clearInterval(sessionTimerInterval);

    // Filter submitted answers
    const formattedAnswers = questions.map((q, idx) => ({
      question: q,
      answer: (answers[idx]?.answer || '').trim(),
    }));

    // Transition to scorecard stage with loading
    interviewStage.classList.add('hidden');
    scorecardStage.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (reviewListContainer) {
      reviewListContainer.innerHTML = `
        <div class="loading-state">
          <i class="fa-solid fa-circle-notch fa-spin"></i>
          <h3>Evaluating interview responses...</h3>
          <p>Analyzing technical depth, keyword coverage, and structure.</p>
        </div>
      `;
    }

    try {
      const response = await fetch('/complete-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: formattedAnswers,
          job_role: window.interviewRole || 'General',
          candidate_id: window.accountEmail || 'candidate',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Evaluation could not be processed.');
      }

      renderScorecard(data);
    } catch (err) {
      console.error("Evaluation error:", err);
      if (reviewListContainer) {
        reviewListContainer.innerHTML = `
          <div class="error-callout">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div>
              <strong>Error completing interview</strong>
              <p>${err.message}</p>
            </div>
          </div>
        `;
      }
    }
  }

  function renderScorecard(data) {
    const score = data.score || 0;
    const grade = data.grade || 'Competent';
    const evaluations = data.evaluations || [];

    // Hero Scorecard
    if (heroScoreVal) heroScoreVal.textContent = score;
    if (heroGradePill) {
      heroGradePill.textContent = grade;
      heroGradePill.className = `hire-grade-pill ${grade.toLowerCase().replace(/\s+/g, '-')}`;
    }

    if (heroHeadline) {
      if (score >= 85) {
        heroHeadline.textContent = "Exceptional Interview! Strong Recommendation for Hire.";
      } else if (score >= 70) {
        heroHeadline.textContent = "Strong Performance. Candidate meets core role requirements.";
      } else if (score >= 50) {
        heroHeadline.textContent = "Competent Candidate with practical foundation. Needs depth in advanced areas.";
      } else {
        heroHeadline.textContent = "Needs Further Technical Preparation and structured answers.";
      }
    }

    // Sub-metrics
    const techScore = data.technical_score || Math.round(score * 0.9);
    const commScore = data.communication_score || Math.min(100, Math.round(score * 1.05));
    const answeredTotal = evaluations.filter(e => e.user_answer && e.user_answer.trim()).length;

    if (metricTechnical) metricTechnical.textContent = `${techScore}%`;
    if (fillTechnical) fillTechnical.style.width = `${techScore}%`;
    if (metricCommunication) metricCommunication.textContent = `${commScore}%`;
    if (fillCommunication) fillCommunication.style.width = `${commScore}%`;
    if (metricAnswered) metricAnswered.textContent = `${answeredTotal}/${evaluations.length}`;
    if (fillAnswered) fillAnswered.style.width = `${(answeredTotal / (evaluations.length || 1)) * 100}%`;

    // Render detailed questions breakdown
    if (reviewListContainer) {
      reviewListContainer.innerHTML = evaluations.map((item, idx) => {
        const q = item.question || {};
        const qScore = item.score || 0;
        const matched = item.matched_concepts || [];
        const missing = item.missing_concepts || [];
        const suggestions = item.suggestions || [];
        const ans = item.user_answer || '';

        return `
          <div class="review-card panel">
            <div class="review-card-top">
              <div class="review-q-info">
                <span class="step-badge">Question ${idx + 1}</span>
                <span class="category-tag">${q.category || 'General'}</span>
                <span class="pill-difficulty ${(q.difficulty || 'medium').toLowerCase()}">${q.difficulty || 'Medium'}</span>
              </div>
              <div class="review-score-pill ${qScore >= 75 ? 'high' : qScore >= 50 ? 'medium' : 'low'}">
                <strong>${qScore}</strong> / 100
              </div>
            </div>

            <h4 class="review-question-text">${q.question || ''}</h4>

            <div class="review-answer-box">
              <span class="answer-box-label"><i class="fa-solid fa-comment-dots"></i> Candidate's Answer:</span>
              <p class="candidate-transcript">${ans ? escapeHtml(ans) : '<em class="text-muted">No response provided for this question.</em>'}</p>
            </div>

            <div class="feedback-box">
              <strong><i class="fa-solid fa-robot text-blue"></i> AI Evaluation:</strong>
              <p>${item.feedback || 'Good attempt.'}</p>
            </div>

            <div class="concept-breakdown">
              ${matched.length ? `
                <div class="concept-tags-group">
                  <span class="concept-label matched"><i class="fa-solid fa-check"></i> Matched Keywords:</span>
                  <div class="tags-row">
                    ${matched.map(c => `<span class="tag matched">${escapeHtml(c)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${missing.length ? `
                <div class="concept-tags-group">
                  <span class="concept-label missing"><i class="fa-solid fa-lightbulb"></i> Recommended Concepts:</span>
                  <div class="tags-row">
                    ${missing.map(c => `<span class="tag missing">${escapeHtml(c)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            ${suggestions.length ? `
              <div class="suggestion-callout">
                <i class="fa-solid fa-graduation-cap"></i>
                <div>
                  <strong>Next-Step Improvement:</strong>
                  <span>${suggestions.join(' ')}</span>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  // 7. EVENT LISTENERS & WIRING
  // ============================================================
  function setupEventListeners() {
    // Lobby
    if (toggleCamLobby) toggleCamLobby.addEventListener('click', toggleCamera);
    if (toggleMicLobby) toggleMicLobby.addEventListener('click', toggleMicrophone);
    if (requestCameraBtn) requestCameraBtn.addEventListener('click', () => initMediaStream(lobbyVideo));

    if (startInterviewBtn) {
      startInterviewBtn.addEventListener('click', async () => {
        // Switch to interview studio
        lobbyStage.classList.add('hidden');
        interviewStage.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Connect media to studio video element
        await initMediaStream(studioVideo);
        if (studioVideo && userMediaStream) {
          studioVideo.srcObject = userMediaStream;
          studioVideo.play().catch(() => {});
        }

        // Init speech recognition
        initSpeechRecognition();

        // Start session timer and first question
        startSessionTimer();
        renderQuestion();
      });
    }

    // Studio Media Controls
    if (toggleCamStudio) toggleCamStudio.addEventListener('click', toggleCamera);
    if (toggleMicStudio) toggleMicStudio.addEventListener('click', toggleMicrophone);
    if (soundToggleBtn) soundToggleBtn.addEventListener('click', toggleAiVoice);

    if (leaveInterviewBtn) {
      leaveInterviewBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to exit the interview? Your progress will be saved.")) {
          finishInterview();
        }
      });
    }

    if (hearQuestionBtn) {
      hearQuestionBtn.addEventListener('click', () => {
        const item = questions[currentQuestionIndex];
        if (item) speakQuestion(item.question);
      });
    }

    // Voice Dictation
    if (voiceDictationBtn) voiceDictationBtn.addEventListener('click', toggleDictation);
    if (studioAnswerArea) studioAnswerArea.addEventListener('input', updateWordCount);

    // Hint toggle
    if (toggleHintBtn) {
      toggleHintBtn.addEventListener('click', () => {
        if (!keywordHintBox) return;
        const isHidden = keywordHintBox.classList.contains('hidden');
        keywordHintBox.classList.toggle('hidden', !isHidden);
        toggleHintBtn.textContent = isHidden ? 'Hide keywords hint' : 'Show keywords hint';
      });
    }

    // Next / Previous / Skip
    if (prevQuestionBtn) {
      prevQuestionBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
          saveCurrentAnswer();
          currentQuestionIndex--;
          renderQuestion();
        }
      });
    }

    if (skipQuestionBtn) {
      skipQuestionBtn.addEventListener('click', () => {
        saveCurrentAnswer();
        if (currentQuestionIndex < questions.length - 1) {
          currentQuestionIndex++;
          renderQuestion();
        } else {
          finishInterview();
        }
      });
    }

    if (nextQuestionBtn) {
      nextQuestionBtn.addEventListener('click', () => {
        saveCurrentAnswer();
        if (currentQuestionIndex < questions.length - 1) {
          currentQuestionIndex++;
          renderQuestion();
        } else {
          finishInterview();
        }
      });
    }

    if (finishInterviewEarlyBtn) {
      finishInterviewEarlyBtn.addEventListener('click', () => {
        if (confirm("Finish interview and view your evaluation now?")) {
          finishInterview();
        }
      });
    }

    // Drawer roadmap clicks
    if (questionNavList) {
      questionNavList.addEventListener('click', (e) => {
        const btn = e.target.closest('.drawer-item');
        if (!btn) return;
        const targetIdx = parseInt(btn.dataset.index, 10);
        if (!isNaN(targetIdx) && targetIdx !== currentQuestionIndex) {
          saveCurrentAnswer();
          currentQuestionIndex = targetIdx;
          renderQuestion();
        }
      });
    }

    // Retake interview
    if (retakeInterviewBtn) {
      retakeInterviewBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }

    // Clean up on window unload
    window.addEventListener('beforeunload', () => {
      releaseMediaStream();
      if (synth) synth.cancel();
      if (animFrameId) cancelAnimationFrame(animFrameId);
    });

    // Release the camera when another tab becomes active, then reacquire it on return.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        releaseMediaStream();
        return;
      }
      const activeVideo = interviewStage && !interviewStage.classList.contains('hidden')
        ? studioVideo
        : lobbyVideo;
      initMediaStream(activeVideo);
    });
  }

  // ============================================================
  // 8. AUTO-INITIALIZATION ON PAGE LOAD
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Auto-attempt webcam preview in lobby
    initMediaStream(lobbyVideo);
  });

})();
