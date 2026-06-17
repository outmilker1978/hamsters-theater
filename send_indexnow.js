const https = require('https');
const key = '83852221bbbf4ab690391c3e029a313e';
const host = 'tvhamsters.outmilk.online';

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error('Usage: node send_indexnow.js <url1> [url2] ...');
  console.error('Example: node send_indexnow.js https://tvhamsters.outmilk.online/blog.html');
  process.exit(1);
}

const data = JSON.stringify({
  host,
  key,
  keyLocation: 'https://' + host + '/' + key + '.txt',
  urlList: urls
});

const req = https.request({
  hostname: 'api.indexnow.org',
  path: '/indexnow',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    if (res.statusCode === 202) {
      console.log('OK: IndexNow accepted (' + urls.length + ' URLs)');
    } else {
      console.log('Status: ' + res.statusCode + ' - ' + body);
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();
