// Landing Page - Newsletter subscription
document.addEventListener('DOMContentLoaded', () => {
  // Newsletter form
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const btn = newsletterForm.querySelector('button');
      const origText = btn.textContent;
      
      btn.textContent = 'Subscribing...';
      btn.disabled = true;

      try {
        const result = await apiPost('/api/subscribe', { email: emailInput.value });
        showToast(result.message);
        emailInput.value = '';
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.textContent = origText;
        btn.disabled = false;
      }
    });
  }

  // Navigate to catalog
  document.querySelectorAll('[data-navigate]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = el.dataset.navigate;
    });
  });
});
