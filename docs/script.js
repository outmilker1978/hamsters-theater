// Форма обратной связи
const formNext = document.getElementById('formNext');
if (formNext) formNext.value = window.location.href.split('?')[0].split('#')[0] + '?sent=ok';

const params = new URLSearchParams(window.location.search);
if (params.get('sent') === 'ok') {
  const form = document.getElementById('feedbackForm');
  const success = document.getElementById('formSuccess');
  if (form) form.style.display = 'none';
  if (success) success.style.display = 'block';
}
