document.getElementById('feedbackForm').addEventListener('submit', function(e) {
  e.preventDefault();
  fetch('https://formsubmit.co/ajax/f454d2a1c6f1ddb50020834507d9c29a', {
    method: 'POST',
    body: new FormData(this)
  }).then(function(r) {
    document.getElementById('feedbackForm').reset();
    document.getElementById('formSuccess').style.display = 'block';
    setTimeout(function() {
      document.getElementById('formSuccess').style.display = 'none';
    }, 4000);
  }).catch(function() {
    document.getElementById('feedbackForm').reset();
    document.getElementById('formSuccess').style.display = 'block';
    setTimeout(function() {
      document.getElementById('formSuccess').style.display = 'none';
    }, 4000);
  });
});