// Отправка формы через fetch — пользователь остаётся на сайте
const form = document.getElementById('feedbackForm');
const success = document.getElementById('formSuccess');

form.addEventListener('submit', function(e) {
  e.preventDefault();
  var data = new URLSearchParams(new FormData(form));
  fetch('https://formsubmit.co/f454d2a1c6f1ddb50020834507d9c29a', {
    method: 'POST',
    mode: 'no-cors',
    body: data
  }).then(function() {
    form.reset();
    success.style.display = 'block';
    setTimeout(function() { success.style.display = 'none'; }, 4000);
  }).catch(function() {
    form.reset();
    success.style.display = 'block';
    setTimeout(function() { success.style.display = 'none'; }, 4000);
  });
});