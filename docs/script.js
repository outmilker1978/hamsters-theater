// Форма обратной связи
const url = window.location.href.split('?')[0].split('#')[0];
const formNext = document.getElementById('formNext');
if (formNext) formNext.value = url + '?sent=ok';
