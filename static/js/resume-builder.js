/* ============================================================
   Interactive Resume Builder Engine
   Real-time A4 Live Preview, Dynamic Repeaters & PDF Print Export
============================================================ */

(function () {
  'use strict';

  // State
  let state = {
    theme: 'theme-navy',
    density: 'normal',
    personal: {
      name: 'Aarav Mehta',
      title: 'Senior Python & Full Stack Engineer',
      email: 'aarav.mehta@example.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, India',
      website: 'aaravmehta.dev',
      linkedin: 'linkedin.com/in/aarav-mehta',
      github: 'github.com/aaravmehta',
    },
    summary: 'Results-oriented Software Engineer with 4+ years of experience designing and scaling high-performance web applications and REST APIs using Python, Flask, React, and PostgreSQL. Proven track record of improving system uptime by 30% and leading microservice migrations.',
    skills: {
      languages: 'Python, JavaScript, TypeScript, SQL, Bash',
      frameworks: 'Flask, FastAPI, Django, React.js, Node.js, Express, SQLAlchemy',
      databases: 'PostgreSQL, MySQL, MongoDB, Redis',
      tools: 'Docker, Kubernetes, AWS (EC2, S3), Git, CI/CD (GitHub Actions), Linux, Postman',
    },
    experience: [
      {
        id: 'exp_1',
        title: 'Senior Backend Engineer',
        company: 'CloudScale Technologies',
        location: 'Bengaluru, India',
        dates: '2023 - Present',
        bullets: 'Architected and deployed 8+ microservices with Flask and FastAPI, reducing API latency by 42% for 2M+ monthly active users.\nContainerized applications using Docker and orchestrated zero-downtime rolling deployments via Kubernetes on AWS.\nMentored 4 junior engineers on code reviews, asynchronous programming, and clean architecture best practices.'
      },
      {
        id: 'exp_2',
        title: 'Full Stack Developer',
        company: 'Innovate Digital Labs',
        location: 'Pune, India',
        dates: '2021 - 2023',
        bullets: 'Engineered responsive web client dashboards using React.js and RESTful backend APIs in Python.\nDesigned and optimized PostgreSQL schema with indexing and query tuning, improving database response times by 35%.\nCollaborated in Agile sprints with product designers to ship 14 core features ahead of quarterly milestones.'
      }
    ],
    projects: [
      {
        id: 'proj_1',
        name: 'Distributed Task Queue System',
        tech: 'Python, Redis, Celery, Docker',
        link: 'github.com/aaravmehta/task-queue',
        bullets: 'Engineered an asynchronous distributed task processor handling 5,000+ jobs/minute with exponential backoff retries.\nImplemented real-time health telemetry and alerting dashboards using Prometheus and Grafana.'
      },
      {
        id: 'proj_2',
        name: 'AI-Powered Virtual HR Platform',
        tech: 'Python, Flask, JavaScript, WebRTC, PyPDF2',
        link: 'github.com/aaravmehta/virtual-hr',
        bullets: 'Developed real-time video and audio mock interview proctoring with automated candidate response evaluations.\nBuilt an automated ATS parser evaluating keyword coverage and section completeness across uploaded PDF resumes.'
      }
    ],
    education: [
      {
        id: 'edu_1',
        degree: 'Bachelor of Technology (B.Tech)',
        major: 'Computer Science & Engineering',
        school: 'National Institute of Technology',
        dates: '2017 - 2021',
        score: 'CGPA: 8.8 / 10'
      }
    ],
    certifications: [
      'AWS Certified Solutions Architect – Associate (2024)',
      'Certified Kubernetes Application Developer (CKAD) – Cloud Native Computing Foundation'
    ]
  };

  // SUMMARY TEMPLATES
  const SUMMARY_TEMPLATES = {
    python: 'Experienced Python Developer with strong background in designing scalable backend architectures, REST APIs, and microservices using Flask, FastAPI, and SQLAlchemy. Passionate about clean code, test-driven development, and database query optimization.',
    fullstack: 'Full Stack Engineer with hands-on expertise building end-to-end web applications with modern JavaScript/TypeScript (React.js, Node.js) and robust backend systems (Python, PostgreSQL). Experienced in optimizing Core Web Vitals and CI/CD automation.',
    data: 'Data Analyst skilled in transforming complex raw datasets into actionable business intelligence using SQL, Python (Pandas, NumPy), and interactive visualization dashboards. Experienced in cohort analysis, A/B testing validation, and executive reporting.',
    qa: 'Quality Assurance & Test Automation Engineer proficient in developing maintainable end-to-end test suites using Selenium WebDriver, pytest, and Postman API testing. Committed to reducing flaky tests and integrating automated gates into CI/CD pipelines.',
    devops: 'DevOps & Cloud Engineer dedicated to automating infrastructure provisioning, container orchestration, and continuous deployment using Docker, Kubernetes, Terraform, and AWS. Proven success in improving MTTR and cloud reliability.'
  };

  // DOM Elements - Form
  const rbName = document.getElementById('rbName');
  const rbTitle = document.getElementById('rbTitle');
  const rbEmail = document.getElementById('rbEmail');
  const rbPhone = document.getElementById('rbPhone');
  const rbLocation = document.getElementById('rbLocation');
  const rbWebsite = document.getElementById('rbWebsite');
  const rbLinkedin = document.getElementById('rbLinkedin');
  const rbGithub = document.getElementById('rbGithub');
  const rbSummary = document.getElementById('rbSummary');
  const summaryTemplateSelect = document.getElementById('summaryTemplateSelect');
  const rbSkillLangs = document.getElementById('rbSkillLangs');
  const rbSkillFrameworks = document.getElementById('rbSkillFrameworks');
  const rbSkillDatabases = document.getElementById('rbSkillDatabases');
  const rbSkillTools = document.getElementById('rbSkillTools');

  const experienceList = document.getElementById('experienceList');
  const addExperienceBtn = document.getElementById('addExperienceBtn');
  const projectList = document.getElementById('projectList');
  const addProjectBtn = document.getElementById('addProjectBtn');
  const educationList = document.getElementById('educationList');
  const addEducationBtn = document.getElementById('addEducationBtn');
  const certList = document.getElementById('certList');
  const addCertBtn = document.getElementById('addCertBtn');

  // Preview Elements
  const a4Paper = document.getElementById('a4Paper');
  const pvName = document.getElementById('pvName');
  const pvTitle = document.getElementById('pvTitle');
  const pvContactBar = document.getElementById('pvContactBar');
  const pvSummary = document.getElementById('pvSummary');
  const pvSkillsRows = document.getElementById('pvSkillsRows');
  const pvExperienceEntries = document.getElementById('pvExperienceEntries');
  const pvProjectEntries = document.getElementById('pvProjectEntries');
  const pvEducationEntries = document.getElementById('pvEducationEntries');
  const pvCertEntries = document.getElementById('pvCertEntries');

  // Action Buttons
  const printResumeBtn = document.getElementById('printResumeBtn');
  const quickPrintBtn = document.getElementById('quickPrintBtn');

  // ============================================================
  // 1. REPEATER RENDERING (FORM INPUTS)
  // ============================================================
  function renderExperienceForm() {
    if (!experienceList) return;
    experienceList.innerHTML = state.experience.map((item, idx) => `
      <div class="repeater-card" data-id="${item.id}">
        <div class="repeater-card-header">
          <span class="repeater-title"><strong>${escapeHtml(item.title || 'Position')}</strong> at ${escapeHtml(item.company || 'Company')}</span>
          <button type="button" class="remove-btn" onclick="window.removeExperience('${item.id}')" title="Delete position">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="form-grid">
          <label>
            <span>Job Title</span>
            <input type="text" value="${escapeHtml(item.title)}" oninput="window.updateExperience('${item.id}', 'title', this.value)">
          </label>
          <label>
            <span>Company Name</span>
            <input type="text" value="${escapeHtml(item.company)}" oninput="window.updateExperience('${item.id}', 'company', this.value)">
          </label>
          <label>
            <span>Location</span>
            <input type="text" value="${escapeHtml(item.location)}" oninput="window.updateExperience('${item.id}', 'location', this.value)">
          </label>
          <label>
            <span>Dates / Tenure (e.g. 2022 - Present)</span>
            <input type="text" value="${escapeHtml(item.dates)}" oninput="window.updateExperience('${item.id}', 'dates', this.value)">
          </label>
          <label class="full">
            <span>Responsibilities & Achievements (One per line)</span>
            <textarea rows="3" oninput="window.updateExperience('${item.id}', 'bullets', this.value)">${escapeHtml(item.bullets)}</textarea>
          </label>
        </div>
      </div>
    `).join('');
  }

  function renderProjectsForm() {
    if (!projectList) return;
    projectList.innerHTML = state.projects.map((item) => `
      <div class="repeater-card" data-id="${item.id}">
        <div class="repeater-card-header">
          <span class="repeater-title"><strong>${escapeHtml(item.name || 'Project')}</strong></span>
          <button type="button" class="remove-btn" onclick="window.removeProject('${item.id}')" title="Delete project">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="form-grid">
          <label>
            <span>Project Name</span>
            <input type="text" value="${escapeHtml(item.name)}" oninput="window.updateProject('${item.id}', 'name', this.value)">
          </label>
          <label>
            <span>Technologies Used</span>
            <input type="text" value="${escapeHtml(item.tech)}" oninput="window.updateProject('${item.id}', 'tech', this.value)">
          </label>
          <label class="full">
            <span>Link / GitHub URL (Optional)</span>
            <input type="text" value="${escapeHtml(item.link)}" oninput="window.updateProject('${item.id}', 'link', this.value)">
          </label>
          <label class="full">
            <span>Key Details & Metrics (One per line)</span>
            <textarea rows="2" oninput="window.updateProject('${item.id}', 'bullets', this.value)">${escapeHtml(item.bullets)}</textarea>
          </label>
        </div>
      </div>
    `).join('');
  }

  function renderEducationForm() {
    if (!educationList) return;
    educationList.innerHTML = state.education.map((item) => `
      <div class="repeater-card" data-id="${item.id}">
        <div class="repeater-card-header">
          <span class="repeater-title"><strong>${escapeHtml(item.degree || 'Degree')}</strong></span>
          <button type="button" class="remove-btn" onclick="window.removeEducation('${item.id}')" title="Delete education">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="form-grid">
          <label>
            <span>Degree & Major</span>
            <input type="text" value="${escapeHtml(item.degree)}" oninput="window.updateEducation('${item.id}', 'degree', this.value)">
          </label>
          <label>
            <span>College / University</span>
            <input type="text" value="${escapeHtml(item.school)}" oninput="window.updateEducation('${item.id}', 'school', this.value)">
          </label>
          <label>
            <span>Graduation Year (e.g. 2021)</span>
            <input type="text" value="${escapeHtml(item.dates)}" oninput="window.updateEducation('${item.id}', 'dates', this.value)">
          </label>
          <label>
            <span>CGPA / Grade (Optional)</span>
            <input type="text" value="${escapeHtml(item.score)}" oninput="window.updateEducation('${item.id}', 'score', this.value)">
          </label>
        </div>
      </div>
    `).join('');
  }

  function renderCertForm() {
    if (!certList) return;
    certList.innerHTML = state.certifications.map((item, idx) => `
      <div class="repeater-row">
        <input type="text" value="${escapeHtml(item)}" oninput="window.updateCert(${idx}, this.value)" placeholder="e.g. AWS Certified Solutions Architect">
        <button type="button" class="remove-btn" onclick="window.removeCert(${idx})" title="Delete certification">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  }

  // Global window functions for repeater item updates
  window.updateExperience = (id, field, val) => {
    const item = state.experience.find(e => e.id === id);
    if (item) { item[field] = val; renderLivePreview(); }
  };
  window.removeExperience = (id) => {
    state.experience = state.experience.filter(e => e.id !== id);
    renderExperienceForm();
    renderLivePreview();
  };

  window.updateProject = (id, field, val) => {
    const item = state.projects.find(p => p.id === id);
    if (item) { item[field] = val; renderLivePreview(); }
  };
  window.removeProject = (id) => {
    state.projects = state.projects.filter(p => p.id !== id);
    renderProjectsForm();
    renderLivePreview();
  };

  window.updateEducation = (id, field, val) => {
    const item = state.education.find(e => e.id === id);
    if (item) { item[field] = val; renderLivePreview(); }
  };
  window.removeEducation = (id) => {
    state.education = state.education.filter(e => e.id !== id);
    renderEducationForm();
    renderLivePreview();
  };

  window.updateCert = (idx, val) => {
    state.certifications[idx] = val;
    renderLivePreview();
  };
  window.removeCert = (idx) => {
    state.certifications.splice(idx, 1);
    renderCertForm();
    renderLivePreview();
  };

  // ============================================================
  // 2. LIVE REAL-TIME PREVIEW RENDERER
  // ============================================================
  function renderLivePreview() {
    // 1. Header
    if (pvName) pvName.textContent = state.personal.name || 'Your Full Name';
    if (pvTitle) pvTitle.textContent = state.personal.title || 'Target Job Title';

    // Contact Chips
    if (pvContactBar) {
      const p = state.personal;
      const chips = [];
      if (p.email) chips.push(`<span class="contact-item"><i class="fa-solid fa-envelope"></i> ${escapeHtml(p.email)}</span>`);
      if (p.phone) chips.push(`<span class="contact-item"><i class="fa-solid fa-phone"></i> ${escapeHtml(p.phone)}</span>`);
      if (p.location) chips.push(`<span class="contact-item"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(p.location)}</span>`);
      if (p.linkedin) chips.push(`<span class="contact-item"><i class="fa-brands fa-linkedin"></i> ${escapeHtml(p.linkedin)}</span>`);
      if (p.github) chips.push(`<span class="contact-item"><i class="fa-brands fa-github"></i> ${escapeHtml(p.github)}</span>`);
      if (p.website) chips.push(`<span class="contact-item"><i class="fa-solid fa-globe"></i> ${escapeHtml(p.website)}</span>`);
      pvContactBar.innerHTML = chips.join('<span class="contact-dot">•</span>');
    }

    // 2. Summary
    const secSummary = document.getElementById('secSummary');
    if (secSummary) {
      if (state.summary && state.summary.trim()) {
        secSummary.style.display = 'block';
        if (pvSummary) pvSummary.textContent = state.summary;
      } else {
        secSummary.style.display = 'none';
      }
    }

    // 3. Technical Skills
    const secSkills = document.getElementById('secSkills');
    if (secSkills && pvSkillsRows) {
      const s = state.skills;
      const rows = [];
      if (s.languages) rows.push(`<div><strong>Languages:</strong> <span>${escapeHtml(s.languages)}</span></div>`);
      if (s.frameworks) rows.push(`<div><strong>Frameworks & Libraries:</strong> <span>${escapeHtml(s.frameworks)}</span></div>`);
      if (s.databases) rows.push(`<div><strong>Databases & Storage:</strong> <span>${escapeHtml(s.databases)}</span></div>`);
      if (s.tools) rows.push(`<div><strong>Developer Tools & Cloud:</strong> <span>${escapeHtml(s.tools)}</span></div>`);

      if (rows.length) {
        secSkills.style.display = 'block';
        pvSkillsRows.innerHTML = rows.join('');
      } else {
        secSkills.style.display = 'none';
      }
    }

    // 4. Experience
    const secExperience = document.getElementById('secExperience');
    if (secExperience && pvExperienceEntries) {
      if (state.experience.length) {
        secExperience.style.display = 'block';
        pvExperienceEntries.innerHTML = state.experience.map(exp => {
          const bullets = (exp.bullets || '').split('\n').filter(b => b.trim());
          return `
            <div class="pv-entry">
              <div class="pv-entry-head">
                <span class="pv-role"><strong>${escapeHtml(exp.title || 'Role')}</strong>, ${escapeHtml(exp.company || 'Company')}</span>
                <span class="pv-meta">${escapeHtml(exp.dates || '')} · ${escapeHtml(exp.location || '')}</span>
              </div>
              ${bullets.length ? `
                <ul class="pv-bullets">
                  ${bullets.map(b => `<li>${escapeHtml(b.trim())}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `;
        }).join('');
      } else {
        secExperience.style.display = 'none';
      }
    }

    // 5. Projects
    const secProjects = document.getElementById('secProjects');
    if (secProjects && pvProjectEntries) {
      if (state.projects.length) {
        secProjects.style.display = 'block';
        pvProjectEntries.innerHTML = state.projects.map(proj => {
          const bullets = (proj.bullets || '').split('\n').filter(b => b.trim());
          return `
            <div class="pv-entry">
              <div class="pv-entry-head">
                <span class="pv-role"><strong>${escapeHtml(proj.name || 'Project')}</strong> ${proj.tech ? `<small>| ${escapeHtml(proj.tech)}</small>` : ''}</span>
                <span class="pv-meta">${proj.link ? escapeHtml(proj.link) : ''}</span>
              </div>
              ${bullets.length ? `
                <ul class="pv-bullets">
                  ${bullets.map(b => `<li>${escapeHtml(b.trim())}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `;
        }).join('');
      } else {
        secProjects.style.display = 'none';
      }
    }

    // 6. Education
    const secEducation = document.getElementById('secEducation');
    if (secEducation && pvEducationEntries) {
      if (state.education.length) {
        secEducation.style.display = 'block';
        pvEducationEntries.innerHTML = state.education.map(edu => `
          <div class="pv-entry">
            <div class="pv-entry-head">
              <span class="pv-role"><strong>${escapeHtml(edu.degree || 'Degree')}</strong>${edu.school ? `, ${escapeHtml(edu.school)}` : ''}</span>
              <span class="pv-meta">${escapeHtml(edu.dates || '')} ${edu.score ? `· ${escapeHtml(edu.score)}` : ''}</span>
            </div>
          </div>
        `).join('');
      } else {
        secEducation.style.display = 'none';
      }
    }

    // 7. Certifications
    const secCertifications = document.getElementById('secCertifications');
    if (secCertifications && pvCertEntries) {
      const validCerts = state.certifications.filter(c => c && c.trim());
      if (validCerts.length) {
        secCertifications.style.display = 'block';
        pvCertEntries.innerHTML = validCerts.map(c => `<li>${escapeHtml(c.trim())}</li>`).join('');
      } else {
        secCertifications.style.display = 'none';
      }
    }
  }

  // ============================================================
  // 3. EVENT LISTENERS & BINDINGS
  // ============================================================
  function setupFormBindings() {
    // Personal details
    if (rbName) rbName.addEventListener('input', e => { state.personal.name = e.target.value; renderLivePreview(); });
    if (rbTitle) rbTitle.addEventListener('input', e => { state.personal.title = e.target.value; renderLivePreview(); });
    if (rbEmail) rbEmail.addEventListener('input', e => { state.personal.email = e.target.value; renderLivePreview(); });
    if (rbPhone) rbPhone.addEventListener('input', e => { state.personal.phone = e.target.value; renderLivePreview(); });
    if (rbLocation) rbLocation.addEventListener('input', e => { state.personal.location = e.target.value; renderLivePreview(); });
    if (rbWebsite) rbWebsite.addEventListener('input', e => { state.personal.website = e.target.value; renderLivePreview(); });
    if (rbLinkedin) rbLinkedin.addEventListener('input', e => { state.personal.linkedin = e.target.value; renderLivePreview(); });
    if (rbGithub) rbGithub.addEventListener('input', e => { state.personal.github = e.target.value; renderLivePreview(); });

    // Summary
    if (rbSummary) rbSummary.addEventListener('input', e => { state.summary = e.target.value; renderLivePreview(); });

    // Summary template dropdown
    if (summaryTemplateSelect) {
      summaryTemplateSelect.addEventListener('change', e => {
        const val = e.target.value;
        if (val && SUMMARY_TEMPLATES[val]) {
          state.summary = SUMMARY_TEMPLATES[val];
          if (rbSummary) rbSummary.value = state.summary;
          renderLivePreview();
        }
      });
    }

    // Technical skills
    if (rbSkillLangs) rbSkillLangs.addEventListener('input', e => { state.skills.languages = e.target.value; renderLivePreview(); });
    if (rbSkillFrameworks) rbSkillFrameworks.addEventListener('input', e => { state.skills.frameworks = e.target.value; renderLivePreview(); });
    if (rbSkillDatabases) rbSkillDatabases.addEventListener('input', e => { state.skills.databases = e.target.value; renderLivePreview(); });
    if (rbSkillTools) rbSkillTools.addEventListener('input', e => { state.skills.tools = e.target.value; renderLivePreview(); });

    // Repeater Add Buttons
    if (addExperienceBtn) {
      addExperienceBtn.addEventListener('click', () => {
        state.experience.push({
          id: 'exp_' + Date.now(),
          title: 'Software Developer',
          company: 'Acme Corp',
          location: 'Remote',
          dates: '2023 - Present',
          bullets: 'Built and tested core web features with Python and JavaScript.\nContributed to daily standups and sprint planning.'
        });
        renderExperienceForm();
        renderLivePreview();
      });
    }

    if (addProjectBtn) {
      addProjectBtn.addEventListener('click', () => {
        state.projects.push({
          id: 'proj_' + Date.now(),
          name: 'Full Stack Project',
          tech: 'Python, Flask, JavaScript, SQL',
          link: 'github.com/your-username/project',
          bullets: 'Engineered backend REST endpoints and responsive web frontend.\nImplemented automated unit tests and user authentication.'
        });
        renderProjectsForm();
        renderLivePreview();
      });
    }

    if (addEducationBtn) {
      addEducationBtn.addEventListener('click', () => {
        state.education.push({
          id: 'edu_' + Date.now(),
          degree: 'Bachelor of Science (B.S.) in Computer Science',
          school: 'State University',
          dates: '2019 - 2023',
          score: 'GPA: 3.8 / 4.0'
        });
        renderEducationForm();
        renderLivePreview();
      });
    }

    if (addCertBtn) {
      addCertBtn.addEventListener('click', () => {
        state.certifications.push('New Certification or Industry Credential');
        renderCertForm();
        renderLivePreview();
      });
    }

    // Theme Picker
    document.querySelectorAll('.theme-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-dot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        state.theme = theme;
        if (a4Paper) {
          a4Paper.className = `a4-sheet ${theme} ${state.density}`;
        }
      });
    });

    // Density Picker
    document.querySelectorAll('.density-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const density = btn.dataset.density;
        state.density = density;
        if (a4Paper) {
          a4Paper.className = `a4-sheet ${state.theme} ${density}`;
        }
      });
    });

    // Print / PDF Download
    const printHandler = () => {
      window.print();
    };
    if (printResumeBtn) printResumeBtn.addEventListener('click', printHandler);
    if (quickPrintBtn) quickPrintBtn.addEventListener('click', printHandler);

    // Check for query parameter from ATS analyzer (?add_skills=...)
    const urlParams = new URLSearchParams(window.location.search);
    const addedSkills = urlParams.get('add_skills');
    if (addedSkills) {
      const current = rbSkillFrameworks ? rbSkillFrameworks.value : '';
      if (rbSkillFrameworks) {
        rbSkillFrameworks.value = current ? `${current}, ${addedSkills}` : addedSkills;
        state.skills.frameworks = rbSkillFrameworks.value;
      }
      showToastNotice(`Added recommended skills from ATS analyzer: ${addedSkills}`);
    }
  }

  function syncFormWithState() {
    if (rbName) rbName.value = state.personal.name;
    if (rbTitle) rbTitle.value = state.personal.title;
    if (rbEmail) rbEmail.value = state.personal.email;
    if (rbPhone) rbPhone.value = state.personal.phone;
    if (rbLocation) rbLocation.value = state.personal.location;
    if (rbWebsite) rbWebsite.value = state.personal.website;
    if (rbLinkedin) rbLinkedin.value = state.personal.linkedin;
    if (rbGithub) rbGithub.value = state.personal.github;
    if (rbSummary) rbSummary.value = state.summary;
    if (rbSkillLangs) rbSkillLangs.value = state.skills.languages;
    if (rbSkillFrameworks) rbSkillFrameworks.value = state.skills.frameworks;
    if (rbSkillDatabases) rbSkillDatabases.value = state.skills.databases;
    if (rbSkillTools) rbSkillTools.value = state.skills.tools;
  }

  function showToastNotice(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  // 4. INITIALIZATION
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    syncFormWithState();
    renderExperienceForm();
    renderProjectsForm();
    renderEducationForm();
    renderCertForm();
    renderLivePreview();
    setupFormBindings();
  });

})();
