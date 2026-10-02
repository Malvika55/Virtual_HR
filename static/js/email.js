(function () {
  'use strict';

  const recipient = document.getElementById('recipient');
  const subject = document.getElementById('subject');
  const message = document.getElementById('message');
  const messageCount = document.getElementById('messageCount');
  const previewRecipient = document.getElementById('previewRecipient');
  const previewSubject = document.getElementById('previewSubject');
  const previewMessage = document.getElementById('previewMessage');
  const clearButton = document.getElementById('clearEmailBtn');

  const templates = {
    received: {
      subject: 'Application received - Virtual HR',
      message: 'Hello Candidate,\n\nThank you for applying. We have received your application and our team will review your profile shortly.\n\nRegards,\nVirtual HR Team',
    },
    interview: {
      subject: 'Interview invitation - Virtual HR',
      message: 'Hello Candidate,\n\nWe would like to invite you to the next stage of our hiring process. Please reply to confirm your availability for the proposed interview time.\n\nRegards,\nVirtual HR Team',
    },
    shortlisted: {
      subject: 'You have been shortlisted - Virtual HR',
      message: 'Hello Candidate,\n\nYour profile has been shortlisted for the next stage. We will share the interview details with you shortly.\n\nCongratulations,\nVirtual HR Team',
    },
    rejected: {
      subject: 'Update on your application - Virtual HR',
      message: 'Hello Candidate,\n\nThank you for the time and effort you invested in the process. We will not be moving forward with your application at this time, but we appreciate your interest in Virtual HR.\n\nRegards,\nVirtual HR Team',
    },
  };

  function updatePreview() {
    if (previewRecipient) previewRecipient.textContent = recipient.value || 'candidate@example.com';
    if (previewSubject) previewSubject.textContent = subject.value || 'Your subject will appear here';
    if (previewMessage) previewMessage.textContent = message.value || 'Your message preview will appear here.';
    if (messageCount) messageCount.textContent = message.value.length;
  }

  document.querySelectorAll('[data-template]').forEach(button => {
    button.addEventListener('click', () => {
      const selected = templates[button.dataset.template];
      if (!selected) return;
      subject.value = selected.subject;
      message.value = selected.message;
      updatePreview();
      document.querySelectorAll('[data-template]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  [recipient, subject, message].forEach(field => {
    if (field) field.addEventListener('input', updatePreview);
  });

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      subject.value = '';
      message.value = '';
      document.querySelectorAll('[data-template]').forEach(item => item.classList.remove('active'));
      updatePreview();
    });
  }

  updatePreview();
})();
