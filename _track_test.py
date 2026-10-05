import sys
import json
import time
import socket
import struct
import os
import base64
import subprocess
import shutil
import urllib.request
from urllib.parse import urlparse

ROOT = r'd:\QR-code-scanner-main'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
SHOT1 = os.path.join(ROOT, '_track_shot1.png')
SHOT2 = os.path.join(ROOT, '_track_shot2.png')
DBG = 9333
HTTP = 8765
CRE = 0x08000000  # CREATE_NO_WINDOW

results = {}


def log(step, data=None):
    print(step + (': ' + json.dumps(data, ensure_ascii=False) if data is not None else ''), flush=True)


def ws_connect(path):
    s = socket.create_connection(('127.0.0.1', DBG), timeout=30)
    key = base64.b64encode(os.urandom(16)).decode()
    req = ('GET %s HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nUpgrade: websocket\r\n'
           'Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n') % (path, DBG, key)
    s.sendall(req.encode())
    buf = b''
    while b'\r\n\r\n' not in buf:
        chunk = s.recv(4096)
        if not chunk:
            raise RuntimeError('ws handshake failed: ' + buf.decode(errors='replace'))
        buf += chunk
    return s


def ws_send(s, text):
    data = text.encode('utf-8')
    mask = os.urandom(4)
    hdr = bytearray([0x81])
    n = len(data)
    if n < 126:
        hdr.append(0x80 | n)
    elif n < 65536:
        hdr.append(0x80 | 126)
        hdr += struct.pack('>H', n)
    else:
        hdr.append(0x80 | 127)
        hdr += struct.pack('>Q', n)
    s.sendall(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))


def ws_recv(s):
    def readn(n):
        buf = b''
        while len(buf) < n:
            c = s.recv(n - len(buf))
            if not c:
                raise EOFError('closed')
            buf += c
        return buf

    b1, b2 = readn(2)
    op = b1 & 0x0F
    ln = b2 & 0x7F
    if ln == 126:
        ln = struct.unpack('>H', readn(2))[0]
    elif ln == 127:
        ln = struct.unpack('>Q', readn(8))[0]
    payload = readn(ln)
    if op == 0x9:
        return ws_recv(s)
    if op == 0x8:
        raise EOFError('closed')
    return payload.decode('utf-8', 'replace')


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.i = 0
        self.events = []

    def cmd(self, method, params=None):
        self.i += 1
        mid = self.i
        ws_send(self.ws, json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws_recv(self.ws))
            if msg.get('id') == mid:
                if 'error' in msg:
                    raise RuntimeError('%s -> %s' % (method, msg['error']))
                return msg.get('result', {})
            self.events.append(msg)

    def evaljs(self, expr, await_promise=False):
        r = self.cmd('Runtime.evaluate', {
            'expression': expr, 'returnByValue': True, 'awaitPromise': await_promise
        })
        if 'exceptionDetails' in r:
            return {'__exception': r['exceptionDetails'].get('text', 'error')}
        return r.get('result', {}).get('value')


def parse(v):
    return json.loads(v) if isinstance(v, str) else v


def main():
    srv = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(HTTP), '--bind', '127.0.0.1'],
        cwd=ROOT, creationflags=CRE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    prof = os.path.join(os.environ.get('TEMP', '.'), 'qrtrack_prof')
    shutil.rmtree(prof, ignore_errors=True)
    chrome = None
    ws = None
    try:
        chrome = subprocess.Popen(
            [CHROME, '--headless', '--remote-debugging-port=%d' % DBG, '--user-data-dir=' + prof,
             '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
             '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
             '--autoplay-policy=no-user-gesture-required', 'about:blank'], creationflags=CRE)
        for _ in range(60):
            try:
                urllib.request.urlopen('http://127.0.0.1:%d/json/version' % DBG, timeout=1).read()
                break
            except Exception:
                time.sleep(0.5)
        for _ in range(40):
            try:
                urllib.request.urlopen('http://127.0.0.1:%d/index.html' % HTTP, timeout=1).read(64)
                break
            except Exception:
                time.sleep(0.5)
        pages = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json/list' % DBG, timeout=5).read())
        page = [p for p in pages if p.get('type') == 'page'][0]
        ws = ws_connect(urlparse(page['webSocketDebuggerUrl']).path)
        c = CDP(ws)
        c.cmd('Page.enable')
        c.cmd('Runtime.enable')
        c.cmd('Emulation.setDeviceMetricsOverride',
              {'width': 412, 'height': 915, 'deviceScaleFactor': 2, 'mobile': True})
        c.cmd('Page.navigate', {'url': 'http://127.0.0.1:%d/index.html' % HTTP})
        time.sleep(4.0)

        results['libs'] = c.evaljs("typeof Html5Qrcode + '|' + typeof jsQR + '|' + typeof BarcodeDetector")
        log('libs', results['libs'])

        # Сканер доступен только авторизованному пользователю: handleRoute() (guard
        # `!currentUser -> auth`) откатывает hash '#/scanner' обратно на экран логина,
        # из-за чего scannerScreen остаётся скрытым (scanOverlay = 0x0).
        c.evaljs("currentUser = { username: 'tracktester', avatar: 'default' }; openQRScanner(); 'ok'")
        time.sleep(4.5)
        results['start'] = parse(c.evaljs("""(function(){
  var v = document.querySelector('#qrReader video');
  var z = document.getElementById('scanZone');
  return JSON.stringify({
    video: !!v,
    playing: v ? (!v.paused && v.readyState >= 2 && v.videoWidth > 0) : false,
    vw: v ? v.videoWidth : 0, vh: v ? v.videoHeight : 0,
    frames: qrTrack.frames, active: qrTrack.active, useNative: qrTrack.useNative,
    status: document.getElementById('scannerStatus').textContent,
    transform: z.style.transform, tracking: z.classList.contains('tracking')
  });})()"""))
        log('start', results['start'])

        results['detect'] = parse(c.evaljs("""(async function(){
  try {
    var url = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=8&data='
      + encodeURIComponent('https://example.com/auth?qr_login=TESTSESS42&v=1');
    var r = await fetch(url);
    if (!r.ok) return JSON.stringify({ok:false, why:'http '+r.status});
    var bmp = await createImageBitmap(await r.blob());
    var cv = document.createElement('canvas'); cv.width = 900; cv.height = 900;
    var g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 900, 900);
    g.drawImage(bmp, 300, 60, 300, 300);
    window.__qrCnv = cv;
    var rect = await qrTrackFrame(cv);
    window.__feedId = setInterval(function(){ qrTrackFrame(window.__qrCnv); }, 100);
    var ov = document.getElementById('scanOverlay');
    return JSON.stringify({ok: !!rect, rect: rect, ov: [ov.clientWidth, ov.clientHeight]});
  } catch (e) { return JSON.stringify({ok:false, why: String(e)}); }})()""", await_promise=True))
        log('detect', results['detect'])

        time.sleep(0.7)
        results['track'] = parse(c.evaljs("""(function(){
  var z = document.getElementById('scanZone');
  var m = /translate3d\\((-?[\\d.]+)px, (-?[\\d.]+)px/.exec(z.style.transform || '');
  var ov = document.getElementById('scanOverlay');
  return JSON.stringify({
    cx: m ? Math.round((parseFloat(m[1]) + z.offsetWidth / 2) * 10) / 10 : null,
    cy: m ? Math.round((parseFloat(m[2]) + z.offsetHeight / 2) * 10) / 10 : null,
    w: z.offsetWidth, h: z.offsetHeight,
    tracking: z.classList.contains('tracking'), lock: z.classList.contains('lock'),
    ov: [ov.clientWidth, ov.clientHeight]
  });})()"""))
        log('track', results['track'])

        shot = c.cmd('Page.captureScreenshot', {'format': 'png'})
        with open(SHOT1, 'wb') as f:
            f.write(base64.b64decode(shot['data']))
        log('shot1 saved')

        d, t = results.get('detect') or {}, results.get('track') or {}
        if d.get('ok') and t.get('cx') is not None:
            rect, w, h = d['rect'], t['w'], t['h']
            cw, ch = t['ov']
            ex = min(max(rect['x'] + rect['w'] / 2, w / 2), cw - w / 2)
            ey = min(max(rect['y'] + rect['h'] / 2, h / 2), ch - h / 2)
            results['follow_err'] = [round(abs(t['cx'] - ex), 1), round(abs(t['cy'] - ey), 1)]
            results['follow_err_home'] = round(abs(t['cy'] - ch * 0.44), 1)
            results['expected_center'] = [round(ex, 1), round(ey, 1)]
        log('follow', {'err': results.get('follow_err'), 'from_home': results.get('follow_err_home')})

        c.evaljs("clearInterval(window.__feedId); qrTrack.lastSeen = -999999; 'ok'")
        time.sleep(0.9)
        results['home'] = parse(c.evaljs("""(function(){
  var z = document.getElementById('scanZone');
  var m = /translate3d\\((-?[\\d.]+)px, (-?[\\d.]+)px/.exec(z.style.transform || '');
  var ov = document.getElementById('scanOverlay');
  return JSON.stringify({
    cx: m ? Math.round((parseFloat(m[1]) + z.offsetWidth / 2) * 10) / 10 : null,
    cy: m ? Math.round((parseFloat(m[2]) + z.offsetHeight / 2) * 10) / 10 : null,
    tracking: z.classList.contains('tracking'),
    homeX: Math.round(ov.clientWidth / 2 * 10) / 10,
    homeY: Math.round(ov.clientHeight * 0.44 * 10) / 10
  });})()"""))
        log('home', results['home'])
        shot = c.cmd('Page.captureScreenshot', {'format': 'png'})
        with open(SHOT2, 'wb') as f:
            f.write(base64.b64decode(shot['data']))
        log('shot2 saved')

        c.evaljs("closeQRScanner(); 'ok'")
        time.sleep(0.7)
        results['closed'] = parse(c.evaljs("""(function(){
  var z = document.getElementById('scanZone');
  return JSON.stringify({
    transform: z.style.transform, tracking: z.classList.contains('tracking'),
    active: qrTrack.active
  });})()"""))
        log('closed', results['closed'])

        errs = []
        for ev in c.events:
            if ev.get('method') == 'Runtime.exceptionThrown':
                dt = ev.get('params', {}).get('exceptionDetails', {})
                errs.append('EXC: ' + str(dt.get('text', '')) + ' ' +
                            str((dt.get('exception') or {}).get('description', ''))[:200])
            if ev.get('method') == 'Runtime.consoleAPICalled' and ev.get('params', {}).get('type') == 'error':
                args = ev.get('params', {}).get('args', [])
                errs.append('ERR: ' + ' '.join(str(x.get('value', '')) for x in args)[:300])
        results['consoleErrors'] = errs
        log('errors', errs)
    finally:
        try:
            if ws:
                ws.close()
        except Exception:
            pass
        if chrome:
            try:
                chrome.kill()
                chrome.wait(timeout=10)
            except Exception:
                pass
        try:
            srv.kill()
        except Exception:
            pass
        shutil.rmtree(prof, ignore_errors=True)

    checks = []
    checks.append(('libs_loaded', isinstance(results.get('libs'), str) and results['libs'].startswith('function|function')))
    s = results.get('start') or {}
    checks.append(('video_playing', bool(s.get('playing'))))
    checks.append(('tracker_running', (s.get('frames') or 0) > 100))
    checks.append(('status_hint', 'Наведите' in (s.get('status') or '')))
    checks.append(('qr_detected', bool((results.get('detect') or {}).get('ok'))))
    checks.append(('tracking_class', bool((results.get('track') or {}).get('tracking'))))
    checks.append(('login_lock_green', bool((results.get('track') or {}).get('lock'))))
    fe = results.get('follow_err')
    if fe:
        checks.append(('follow_err<20px', max(fe) < 20))
        checks.append(('moved_from_home>50px', (results.get('follow_err_home') or 0) > 50))
    hm = results.get('home') or {}
    checks.append(('home_tracking_off', hm.get('tracking') is False))
    if hm.get('cx') is not None:
        checks.append(('home_pos', abs(hm['cx'] - hm['homeX']) < 5 and abs(hm['cy'] - hm['homeY']) < 5))
    cl = results.get('closed') or {}
    checks.append(('cleanup', cl.get('transform') == '' and cl.get('tracking') is False and cl.get('active') is False))
    checks.append(('no_js_errors', len(results.get('consoleErrors') or []) == 0))
    print('CHECKS ' + json.dumps(checks, ensure_ascii=False), flush=True)
    failed = [c[0] for c in checks if not c[1]]
    print('ALL_PASS' if not failed else 'FAILED: ' + ', '.join(failed), flush=True)
    print('RESULTS ' + json.dumps(results, ensure_ascii=False)[:3000], flush=True)
    with open(os.path.join(ROOT, '_track_out.txt'), 'w', encoding='utf-8') as f:
        f.write('CHECKS ' + json.dumps(checks, ensure_ascii=False) + '\n')
        f.write(('ALL_PASS' if not failed else 'FAILED: ' + ', '.join(failed)) + '\n')
        f.write('RESULTS ' + json.dumps(results, ensure_ascii=False) + '\n')
    sys.exit(1 if failed else 0)


main()
