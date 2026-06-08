// Форма обратной связи
const formNext = document.getElementById('formNext');
if (formNext) formNext.value = window.location.origin + '/?sent=ok';

const params = new URLSearchParams(window.location.search);
if (params.get('sent') === 'ok') {
  const success = document.getElementById('formSuccess');
  if (success) success.style.display = 'block';
}
