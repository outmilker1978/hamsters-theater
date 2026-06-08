// Отправка формы в скрытый iframe
document.getElementById('feedbackForm').addEventListener('submit', function() {
  setTimeout(function() {
    document.getElementById('feedbackForm').reset();
    document.getElementById('formSuccess').style.display = 'block';
    setTimeout(function() {
      document.getElementById('formSuccess').style.display = 'none';
    }, 4000);
  }, 1000);
});