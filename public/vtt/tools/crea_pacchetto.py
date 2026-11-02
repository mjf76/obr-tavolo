#!/usr/bin/env python3
"""Crea un pacchetto .tavolo.zip per Tavolo VTT a partire da un file di configurazione.

Uso:  python3 crea_pacchetto.py tavolo_config.json [uscita.zip]

Il file di configurazione (JSON) descrive PG, libreria mostri e mappe; i percorsi
sono relativi alla cartella del file di configurazione. Vedi LEGGIMI.md.
Requisiti: Python 3 + Pillow.
"""
import base64, io, json, os, re, sys, time, zipfile, hashlib
from PIL import Image

LIGHT_MAX = 1600     # lato massimo versione light (telefoni)
FULL_MAX = 4096      # lato massimo immagine tavolo
TOKEN_SIDE = 200     # lato token in libreria / PG

def uid(seed):
    return hashlib.sha1(seed.encode()).hexdigest()[:10]

def data_url(path, side):
    im = Image.open(path).convert('RGBA')
    im.thumbnail((side, side), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def jpeg_bytes(im, side, q):
    im = im.convert('RGB')
    if max(im.size) > side:
        im = im.copy(); im.thumbnail((side, side), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
    return b.getvalue()

def parse_uvtt(path):
    j = json.load(open(path, encoding='utf-8'))
    r = j['resolution']; o = r.get('map_origin', {'x': 0, 'y': 0})
    walls = []
    for k in ('line_of_sight', 'objects_line_of_sight'):
        for pl in j.get(k) or []:
            for a, b in zip(pl, pl[1:]):
                walls.append([round(a['x']-o['x'], 4), round(a['y']-o['y'], 4), round(b['x']-o['x'], 4), round(b['y']-o['y'], 4)])
    doors = [{'a': [p['bounds'][0]['x']-o['x'], p['bounds'][0]['y']-o['y']],
              'b': [p['bounds'][1]['x']-o['x'], p['bounds'][1]['y']-o['y']],
              'closed': p.get('closed', True) is not False} for p in j.get('portals') or []]
    img = Image.open(io.BytesIO(base64.b64decode(j['image']))) if j.get('image') else None
    return dict(w=r['map_size']['x'], h=r['map_size']['y'], ppg=float(r.get('pixels_per_grid') or 100),
                walls=walls, doors=doors, image=img)

def main(cfg_path, out_path=None):
    base = os.path.dirname(os.path.abspath(cfg_path))
    P = lambda p: os.path.normpath(os.path.join(base, p)) if p else None
    cfg = json.load(open(cfg_path, encoding='utf-8'))
    rev = int(time.time() * 1000)
    C = {'v': 1, 'nome': cfg['nome'], 'pg': [], 'mappe': [], 'libreria': []}
    names = {}
    for p in cfg.get('pg', []):
        pid = uid('pg:' + p['nome'])
        names[p['nome'].lower()] = pid
        C['pg'].append({'id': pid, 'nome': p['nome'], 'giocatore': p.get('giocatore', ''),
                        'colore': p.get('colore', '#3a7bd5'), 'raggio': p.get('visione', 0),
                        'img': data_url(P(p['token']), 160) if p.get('token') else None})
    lib = cfg.get('libreria') or {}
    libid = {}
    if lib.get('cartella'):
        d = P(lib['cartella'])
        for f in sorted(os.listdir(d)):
            if not re.search(r'\.(png|jpe?g|webp)$', f, re.I):
                continue
            nome = os.path.splitext(f)[0]
            tid = uid('lib:' + nome); libid[nome.lower()] = tid
            C['libreria'].append({'id': tid, 'nome': nome, 'taglia': (lib.get('taglie') or {}).get(nome, lib.get('taglia', 1)),
                                  'img': data_url(os.path.join(d, f), TOKEN_SIDE)})
    files = {}
    for mc in cfg['mappe']:
        mid = uid('map:' + mc['nome'])
        src = P(mc['file'])
        m = {'id': mid, 'nome': mc['nome'], 'ruoli': {'tavolo': mc.get('tavolo', True), 'pg': mc.get('giocatori', True)},
             'walls': [], 'doors': [], 'fog': False, 'anim': False, 'raggi': {}, 'tokens': [], 'mime': {},
             'rev': rev, 'grid': mc.get('griglia', False), 'src': os.path.basename(src), 'uvtt': False}
        if src.lower().endswith(('.uvtt', '.dd2vtt', '.json')):
            u = parse_uvtt(src); im = u['image']
            if im is None:
                raise SystemExit(f"{mc['nome']}: il .uvtt non contiene l'immagine")
            m.update(uvtt=True, walls=u['walls'], doors=u['doors'], w=u['w'], h=u['h'])
            m['pxW'], m['pxH'] = im.size; m['ppg'] = im.size[0] / u['w']; m['offX'] = m['offY'] = 0
        else:
            im = Image.open(src)
            m['pxW'], m['pxH'] = im.size
            ppg = float(mc.get('ppg') or 100)
            ox, oy = mc.get('offset', [0, 0])
            m.update(ppg=ppg, offX=ox, offY=oy, w=round((im.size[0]-ox)/ppg, 4), h=round((im.size[1]-oy)/ppg, 4))
            if mc.get('muri'):
                u = parse_uvtt(P(mc['muri']))
                m.update(uvtt=True, walls=u['walls'], doors=u['doors'], w=u['w'], h=u['h'], ppg=im.size[0]/u['w'], offX=0, offY=0)
        m['fog'] = bool(mc.get('fog', bool(m['walls'])))
        for nome, r in (mc.get('visione') or {}).items():
            if nome.lower() in names:
                m['raggi'][names[nome.lower()]] = r
        files[f'mappe/{mid}/full'] = jpeg_bytes(im, FULL_MAX, 88); m['mime']['full'] = 'image/jpeg'
        if mc.get('light'):
            files[f'mappe/{mid}/light'] = jpeg_bytes(Image.open(P(mc['light'])), LIGHT_MAX, 80)
            m['lightAuto'] = False
        else:
            files[f'mappe/{mid}/light'] = jpeg_bytes(im, LIGHT_MAX, 80); m['lightAuto'] = True
        m['mime']['light'] = 'image/jpeg'
        if mc.get('video'):
            v = P(mc['video'])
            files[f'mappe/{mid}/video'] = open(v, 'rb').read()
            m['anim'] = True; m['mime']['video'] = 'video/webm' if v.lower().endswith('.webm') else 'video/mp4'
        for t in mc.get('token') or []:
            nome = t['nome']; L = libid.get(re.sub(r' \d+$', '', nome).lower())
            tok = {'id': uid(f"tok:{mid}:{nome}:{t['x']}:{t['y']}"), 'kind': 'npc', 'nome': nome,
                   'x': t['x'], 'y': t['y'], 'hidden': t.get('nascosto', True)}
            if nome.lower() in names:
                tok = {'id': tok['id'], 'kind': 'pg', 'pg': names[nome.lower()], 'x': t['x'], 'y': t['y']}
            elif L:
                tok['lib'] = L
            m['tokens'].append(tok)
        C['mappe'].append(m)
    out = out_path or os.path.join(base, re.sub(r'[^\w\- ]+', '', cfg['nome']).strip().replace(' ', '_') + '.tavolo.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:
        z.writestr('campagna.json', json.dumps(C, ensure_ascii=False))
        for k, v in files.items():
            z.writestr(k, v)
    print(f"{out}: {len(C['pg'])} PG, {len(C['libreria'])} token in libreria, {len(C['mappe'])} mappe, {os.path.getsize(out)/1048576:.1f} MB")
    for m in C['mappe']:
        print(f"  - {m['nome']}: {m['w']:g}×{m['h']:g} q, {'TV ' if m['ruoli']['tavolo'] else ''}{'PG ' if m['ruoli']['pg'] else ''}"
              f"{'fog ' if m['fog'] else ''}{'animata ' if m['anim'] else ''}{len(m['walls'])} muri, {len(m['doors'])} porte")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
