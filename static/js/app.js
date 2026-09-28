document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('menuToggle')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  const toast = document.getElementById('toast');
  document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));
  document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async () => {
    const response = await fetch(`/candidate/${button.dataset.candidate}/status`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: button.dataset.status}) });
    if (response.ok) { showToast(`Candidate moved to ${button.dataset.status}.`); setTimeout(() => window.location.reload(), 500); }
  }));
  window.showToast = message => { if (!toast) return; toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); };
});
