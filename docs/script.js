// Форма обратной связи
const form = document.getElementById('feedbackForm');
const success = document.getElementById('formSuccess');

if (form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const data = new FormData(form);
    fetch(form.action, { method: 'POST', body: data })
      .then(r => {
        if (r.ok) {
          form.style.display = 'none';
          success.style.display = 'block';
        }
      })
      .catch(() => {});
  });
}
