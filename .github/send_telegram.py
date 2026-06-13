import urllib.request, os, sys

CHAT = os.environ.get('CHAT')
TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TAG = os.environ.get('TAG', '')
PARAS = os.environ.get('NOTES', '')
if not PARAS:
    sys.exit(0)

# Build caption from env vars (avoids any shell encoding issues)
paras_first = '\n\n'.join(PARAS.split('\n\n')[:2])
parts = PARAS.split('\n\n')
if len(parts) >= 3:
    third = parts[2].split('\n')[0]
    paras_first = paras_first + '\n\n' + third
if len(paras_first.encode('utf-8')) > 700:
    paras_first = paras_first[:700].encode('utf-8').decode('utf-8', 'ignore')

caption = '<b>TV Hamsters ' + TAG + '</b>\n'
caption += paras_first + '\n\n'
caption += '--- Подробнее: https://tvhamsters.outmilk.online/blog.html\n\n'
caption += 'Site: https://tvhamsters.outmilk.online\n'
caption += 'Windows: https://github.com/outmilker1978/hamsters-theater/releases/tag/' + TAG + '\n'
caption += 'Mobile: https://tvhamsters.outmilk.online/mobile/'

with open('out.png', 'rb') as f: photo = f.read()

boundary = b'----FormBoundary7MA4YW'
crlf = b'\r\n'

body = b'--' + boundary + crlf
body += b'Content-Disposition: form-data; name="chat_id"' + crlf + crlf
body += CHAT.encode('utf-8') + crlf

body += b'--' + boundary + crlf
body += b'Content-Disposition: form-data; name="parse_mode"' + crlf + crlf
body += b'HTML' + crlf

body += b'--' + boundary + crlf
body += b'Content-Disposition: form-data; name="caption"' + crlf + crlf
body += caption.encode('utf-8') + crlf

body += b'--' + boundary + crlf
body += b'Content-Disposition: form-data; name="photo"; filename="photo.png"' + crlf
body += b'Content-Type: application/octet-stream' + crlf + crlf
body += photo + crlf

body += b'--' + boundary + b'--' + crlf

url = 'https://api.telegram.org/bot' + TOKEN + '/sendPhoto'
req = urllib.request.Request(url, data=body,
    headers={'Content-Type': b'multipart/form-data; boundary=' + boundary})

try:
    resp = urllib.request.urlopen(req)
    print('HTTP:', resp.getcode())
    print(resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTP:', e.code)
    sys.stderr.buffer.write(e.read())
    sys.exit(1)
