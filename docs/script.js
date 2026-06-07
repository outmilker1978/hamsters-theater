// Пока заглушка — ссылки на скачивание обновим, когда появится .exe
document.getElementById('downloadBtn').addEventListener('click', function(e) {
  e.preventDefault();
  alert('Файл появится здесь после финальной сборки. Загляни позже!');
});
document.getElementById('downloadBtn2').addEventListener('click', function(e) {
  e.preventDefault();
  alert('Файл появится здесь после финальной сборки. Загляни позже!');
});

document.getElementById('emailLink').addEventListener('click', function(e) {
  e.preventDefault();
  const email = 'outmilker' + '@' + 'gmail.com';
  window.location.href = 'mailto:' + email;
});
