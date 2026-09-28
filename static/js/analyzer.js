/* ============================================================
   Resume & ATS Analyzer Engine
   Interactive File Drops, Tab Switching & Comprehensive Scorecard
============================================================ */

(function () {
  'use strict';

  const resumeForm = document.getElementById('resumeForm');
  const tabUpload = document.getElementById('tabUpload');
  const tabPaste = document.getElementById('tabPaste');
  const uploadInputSection = document.getElementById('uploadInputSection');
  const pasteInputSection = document.getElementById('pasteInputSection');
  const resumeInput = document.getElementById('resumeInput');
  const dropzoneArea = document.getElementById('dropzoneArea');
  const fileInfoDisplay = document.getElementById('fileInfoDisplay');
  const fileNameText = document.getElementById('fileNameText');
  const fileSizeText = document.getElementById('fileSizeText');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const resumeTextArea = document.getElementById('resumeTextArea');
  const analyzeSubmitBtn = document.getElementById('analyzeSubmitBtn');
  const scanProgressArea = document.getElementById('scanProgressArea');
  const scanProgressFill = document.getElementById('scanProgressFill');
  const analyzerResult = document.getElementById('analyzerResult');

  let currentMode = 'upload'; // 'upload' | 'paste'

  // Tab Switching
  tabUpload?.addEventListener('click', () => {
    currentMode = 'upload';
    tabUpload.classList.add('active');
    tabPaste.classList.remove('active');
    uploadInputSection.classList.remove('hidden');
    pasteInputSection.classList.add('hidden');
  });

  tabPaste?.addEventListener('click', () => {
    currentMode = 'paste';
    tabPaste.classList.add('active');
    tabUpload.classList.remove('active');
    pasteInputSection.classList.remove('hidden');
    uploadInputSection.classList.add('hidden');
    if (resumeTextArea) resumeTextArea.focus();
  });

  // Drag and Drop Handling
  if (dropzoneArea) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneArea.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneArea.classList.remove('dragover');
      }, false);
    });

    dropzoneArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        resumeInput.files = files;
        handleFileSelect(files[0]);
      }
    });
  }

  resumeInput?.addEventListener('change', () => {
    if (resumeInput.files && resumeInput.files.length > 0) {
      handleFileSelect(resumeInput.files[0]);
    }
  });

  function handleFileSelect(file) {
    if (!file) return;
    if (fileNameText) fileNameText.textContent = file.name;
    if (fileSizeText) {
      const kb = Math.round(file.size / 1024);
      fileSizeText.textContent = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
    }
    if (dropzoneArea) dropzoneArea.classList.add('hidden');
    if (fileInfoDisplay) fileInfoDisplay.classList.remove('hidden');
  }

  removeFileBtn?.addEventListener('click', () => {
    if (resumeInput) resumeInput.value = '';
    if (fileInfoDisplay) fileInfoDisplay.classList.add('hidden');
    if (dropzoneArea) dropzoneArea.classList.remove('hidden');
  });

  // Form Submission
  resumeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentMode === 'upload' && (!resumeInput.files || !resumeInput.files.length)) {
      alert("Please select a PDF resume file to upload or switch to the 'Paste Text' tab.");
      return;
    }

    if (currentMode === 'paste' && (!resumeTextArea.value || !resumeTextArea.value.trim())) {
      alert("Please paste your resume text before running the scan.");
      return;
    }

    // Show Progress
    if (analyzeSubmitBtn) {
      analyzeSubmitBtn.disabled = true;
      analyzeSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning Document...';
    }
    if (analyzerResult) analyzerResult.classList.add('hidden');
    if (scanProgressArea) scanProgressArea.classList.remove('hidden');
    if (scanProgressFill) {
      scanProgressFill.style.width = '20%';
      setTimeout(() => { scanProgressFill.style.width = '65%'; }, 400);
      setTimeout(() => { scanProgressFill.style.width = '90%'; }, 800);
    }

    const formData = new FormData(resumeForm);
    // If in paste mode, ensure we clear any dummy file input
    if (currentMode === 'paste') {
      formData.delete('resume');
    }

    let data;
    try {
      const response = await fetch('/analyze-resume', {
        method: 'POST',
        body: formData,
      });
      data = await response.json();
    } catch (err) {
      data = { error: 'Network or server error while parsing the resume. Please try again.' };
    }

    // Reset Progress
    if (scanProgressFill) scanProgressFill.style.width = '100%';
    setTimeout(() => {
      if (scanProgressArea) scanProgressArea.classList.add('hidden');
      if (analyzeSubmitBtn) {
        analyzeSubmitBtn.disabled = false;
        analyzeSubmitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Re-Scan Resume';
      }
      renderAtsResult(data);
    }, 450);
  });

  function renderAtsResult(data) {
    if (!analyzerResult) return;
    analyzerResult.classList.remove('hidden');

    if (data.error) {
      analyzerResult.innerHTML = `
        <div class="error-callout">
          <i class="fa-solid fa-circle-exclamation"></i>
          <div>
            <strong>Analysis Failed</strong>
            <p>${escapeHtml(data.error)}</p>
          </div>
        </div>
      `;
      return;
    }

    const score = data.score || 0;
    const rating = data.rating || 'Moderate Fit';
    const badgeClass = data.badge_class || 'primary';
    const breakdown = data.breakdown || {};
    const matched = data.matched_skills || [];
    const missing = data.missing_skills || [];
    const suggestions = data.suggestions || [];
    const sections = data.sections_detected || {};
    const impacts = data.impact_statements || [];

    const sectionItems = [
      { key: 'summary', label: 'Summary / Profile' },
      { key: 'experience', label: 'Work Experience' },
      { key: 'skills', label: 'Technical Skills' },
      { key: 'education', label: 'Education' },
      { key: 'projects', label: 'Projects' }
    ];

    analyzerResult.innerHTML = `
      <div class="ats-report-card">
        <!-- Hero Score Banner -->
        <div class="ats-score-hero">
          <div class="ats-gauge-circle ${badgeClass}">
            <span class="ats-score-val">${score}</span>
            <span class="ats-score-den">/ 100</span>
          </div>
          <div class="ats-hero-copy">
            <span class="badge ${badgeClass} large"><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(rating)}</span>
            <h3>${score >= 80 ? 'Highly Compatible with Modern ATS Systems' : score >= 60 ? 'Competitive Resume with High ATS Alignment' : 'Requires Optimization to Pass ATS Filters'}</h3>
            <p class="muted text-xs">Total word count: ${data.word_count || 0} words • Analyzed on ${data.analysis_date || 'Today'}</p>
          </div>
        </div>

        <!-- Metric Breakdown Bars -->
        <div class="ats-metrics-breakdown">
          <h4>Scoring Dimensions Breakdown</h4>
          <div class="ats-bars-grid">
            <div class="ats-bar-item">
              <div class="bar-meta">
                <span>Hard Skills Match</span>
                <strong>${breakdown.skills_match || 0} / 35</strong>
              </div>
              <div class="mini-bar"><div class="mini-fill" style="width: ${((breakdown.skills_match || 0) / 35) * 100}%"></div></div>
            </div>

            <div class="ats-bar-item">
              <div class="bar-meta">
                <span>Keyword Density</span>
                <strong>${breakdown.keyword_match || 0} / 25</strong>
              </div>
              <div class="mini-bar"><div class="mini-fill" style="width: ${((breakdown.keyword_match || 0) / 25) * 100}%"></div></div>
            </div>

            <div class="ats-bar-item">
              <div class="bar-meta">
                <span>Experience & Impact</span>
                <strong>${breakdown.experience_match || 0} / 20</strong>
              </div>
              <div class="mini-bar"><div class="mini-fill" style="width: ${((breakdown.experience_match || 0) / 20) * 100}%"></div></div>
            </div>

            <div class="ats-bar-item">
              <div class="bar-meta">
                <span>Education Alignment</span>
                <strong>${breakdown.education_match || 0} / 10</strong>
              </div>
              <div class="mini-bar"><div class="mini-fill" style="width: ${((breakdown.education_match || 0) / 10) * 100}%"></div></div>
            </div>

            <div class="ats-bar-item">
              <div class="bar-meta">
                <span>Format & Completeness</span>
                <strong>${breakdown.formatting_and_sections || 0} / 10</strong>
              </div>
              <div class="mini-bar"><div class="mini-fill" style="width: ${((breakdown.formatting_and_sections || 0) / 10) * 100}%"></div></div>
            </div>
          </div>
        </div>

        <!-- Section Detection Checklist -->
        <div class="ats-sections-box">
          <h4>Standard ATS Sections Detected</h4>
          <div class="sections-pills-row">
            ${sectionItems.map(s => `
              <span class="section-detect-pill ${sections[s.key] ? 'found' : 'missing'}">
                <i class="fa-solid ${sections[s.key] ? 'fa-circle-check text-success' : 'fa-circle-xmark text-danger'}"></i>
                ${s.label}
              </span>
            `).join('')}
          </div>
        </div>

        <!-- Skills Comparison Grid -->
        <div class="skills-comparison-grid">
          <div class="skills-box matched">
            <h5><i class="fa-solid fa-check-double text-success"></i> Matched Skills (${matched.length})</h5>
            <div class="chips-wrap">
              ${matched.length ? matched.map(s => `<span class="chip matched"><i class="fa-solid fa-check"></i> ${escapeHtml(s)}</span>`).join('') : '<em class="text-muted text-xs">No direct role skills detected yet</em>'}
            </div>
          </div>

          <div class="skills-box missing">
            <h5><i class="fa-solid fa-triangle-exclamation text-amber"></i> Missing Role Skills (${missing.length})</h5>
            <div class="chips-wrap">
              ${missing.length ? missing.map(s => `<span class="chip missing"><i class="fa-solid fa-plus"></i> ${escapeHtml(s)}</span>`).join('') : '<span class="chip matched"><i class="fa-solid fa-circle-check"></i> 100% Core Skills Present!</span>'}
            </div>
          </div>
        </div>

        ${impacts.length ? `
          <div class="impact-statements-box">
            <h5><i class="fa-solid fa-chart-line text-blue"></i> Detected Quantifiable Impact Highlights</h5>
            <ul class="impact-list">
              ${impacts.map(imp => `<li><i class="fa-solid fa-circle-dot"></i> "${escapeHtml(imp)}"</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Recommendations List -->
        <div class="ats-suggestions-box">
          <h5><i class="fa-solid fa-lightbulb text-amber"></i> Actionable ATS Optimization Steps</h5>
          <div class="suggestions-cards">
            ${suggestions.map((s, idx) => `
              <div class="suggestion-item">
                <span class="step-num">${idx + 1}</span>
                <p>${escapeHtml(s)}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Builder Call-to-Action -->
        <div class="ats-builder-cta">
          <div>
            <strong>Want to build a 100% ATS-compliant resume?</strong>
            <p class="muted text-xs">Use our built-in Resume Builder to generate a clean, correctly formatted resume with all required skills.</p>
          </div>
          <a class="button primary" href="/resume-builder${missing.length ? `?add_skills=${encodeURIComponent(missing.join(', '))}` : ''}">
            <i class="fa-solid fa-pen-to-square"></i> Open in Resume Builder
          </a>
        </div>
      </div>
    `;

    analyzerResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
