// Ссылки на скачивание ведут в GitHub Releases


document.getElementById('emailLink').addEventListener('click', function(e) {
  e.preventDefault();
  const email = 'outmilker' + '@' + 'gmail.com';
  window.location.href = 'mailto:' + email;
});
