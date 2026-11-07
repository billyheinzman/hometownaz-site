#!/usr/bin/env python3
"""
build-flyers.py | Printable one-page flyer PDF for each of our listings.

USAGE (from the site folder, after `node build-homes.js`):
    python build-flyers.py

WHAT IT DOES:
  For every for-sale home in homes/homes.json that has at least one photo in
  homes/photos/<slug>-1.jpg, writes flyers/<slug>.pdf (US Letter). Then rerun
  `node build-homes.js` so the "Download Flyer (PDF)" buttons appear.

  Ink-friendly by design: white page, thin rules, colored text, no big fills.
  Homes listed in flyers/_designed.txt keep the hand-designed flyer already in
  flyers/ and are skipped.

Needs: pip install reportlab qrcode pillow
"""
import json, os, io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image
import qrcode

ROOT = os.path.dirname(os.path.abspath(__file__))
HOMES = os.path.join(ROOT, 'homes', 'homes.json')
OUT = os.path.join(ROOT, 'flyers')
IMG = os.path.join(ROOT, 'images')

GREEN = (0x2d / 255, 0x3d / 255, 0x2e / 255)
ORANGE = (0xc8 / 255, 0x62 / 255, 0x2a / 255)
MUTED = (0x6b / 255, 0x63 / 255, 0x58 / 255)
LINE = (0xd9 / 255, 0xd2 / 255, 0xc4 / 255)
INK = (0x22 / 255, 0x22 / 255, 0x22 / 255)


def font(name, files):
    for f in files:
        if os.path.exists(f):
            pdfmetrics.registerFont(TTFont(name, f))
            return name
    return None


SANS = font('Sans', ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', 'C:/Windows/Fonts/arial.ttf']) or 'Helvetica'
SANSB = font('SansB', ['/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf']) or 'Helvetica-Bold'
SERIFB = font('SerifB', ['/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 'C:/Windows/Fonts/georgiab.ttf']) or 'Times-Bold'


def money(n):
    return '${:,.0f}'.format(n) if n else ''


def num(n):
    return '{:,.0f}'.format(n) if n else ''


def cover(c, path, x, y, w, h):
    """Draw an image cropped to fill the box (like CSS object-fit: cover)."""
    im = Image.open(path).convert('RGB')
    r = w / h
    if im.width / im.height > r:
        nw = int(im.height * r); left = (im.width - nw) // 2
        im = im.crop((left, 0, left + nw, im.height))
    else:
        nh = int(im.width / r); top = (im.height - nh) // 2
        im = im.crop((0, top, im.width, top + nh))
    im = im.resize((int(w * 3), int(h * 3)), Image.LANCZOS)   # ~216 dpi, sharp in print
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=85); buf.seek(0)
    c.drawImage(ImageReader(buf), x, y, w, h)


def qr_image(url):
    q = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url); q.make(fit=True)
    buf = io.BytesIO(); q.make_image(fill_color='black', back_color='white').save(buf, 'PNG'); buf.seek(0)
    return ImageReader(buf)


def flyer(h, path):
    W, H = letter
    M = 36
    c = canvas.Canvas(path, pagesize=letter)
    c.setTitle(f"{h['addr']} | {money(h['price'])}")
    c.setAuthor('Lona King & Billy Heinzman | HomeSmart')

    # header
    c.setFillColorRGB(*ORANGE); c.setFont(SANSB, 9.5)
    c.drawString(M, H - M - 10, (h['community'] or h['city']).upper() + '   |   ' + h['status'].upper())
    c.setFillColorRGB(*GREEN); c.setFont(SANSB, 26)
    c.drawRightString(W - M, H - M - 18, money(h['price']))
    c.setStrokeColorRGB(*ORANGE); c.setLineWidth(1.2)
    c.line(M, H - M - 28, W - M, H - M - 28)

    # photos: one big, or big + strip if more were added
    photos = [os.path.join(ROOT, p.lstrip('/')) for p in h['photos']]
    top = H - M - 38
    if len(photos) == 1:
        ph = 300
        cover(c, photos[0], M, top - ph, W - 2 * M, ph)
        y = top - ph
    else:
        ph = 250
        cover(c, photos[0], M, top - ph, W - 2 * M, ph)
        n = min(len(photos) - 1, 3); gap = 6
        tw = (W - 2 * M - gap * (n - 1)) / n
        for i, p in enumerate(photos[1:1 + n]):
            cover(c, p, M + i * (tw + gap), top - ph - gap - 90, tw, 90)
        y = top - ph - gap - 90
    c.setStrokeColorRGB(*LINE); c.setLineWidth(0.6); c.rect(M, y, W - 2 * M, top - y, stroke=1, fill=0)

    # address
    y -= 34
    c.setFillColorRGB(*GREEN); c.setFont(SERIFB, 24)
    c.drawString(M, y, h['addr'])
    y -= 17
    c.setFillColorRGB(*MUTED); c.setFont(SANS, 11)
    c.drawString(M, y, f"{h['city']}, AZ {h['zip']}" + (f"   |   {h['model']} model" if h['model'] else ''))

    # facts row: thin boxes, colored labels
    y -= 16
    facts = [('BEDS', h['beds']), ('BATHS', h['baths']), ('SQ FT', num(h['sqft'])),
             ('BUILT', h['yr']), ('GARAGE', f"{h['garage']} car" if h['garage'] else ''),
             ('LOT SF', num(h['lotsqft']) if (h['lotsqft'] or 0) > 1000 else '')]
    facts = [f for f in facts if f[1] not in ('', None)]
    bw = (W - 2 * M) / len(facts); bh = 42
    c.setStrokeColorRGB(*LINE); c.setLineWidth(0.6)
    for i, (k, v) in enumerate(facts):
        x = M + i * bw
        c.rect(x, y - bh, bw, bh, stroke=1, fill=0)
        c.setFillColorRGB(*ORANGE); c.setFont(SANSB, 7.5); c.drawCentredString(x + bw / 2, y - 14, k)
        c.setFillColorRGB(*INK); c.setFont(SANSB, 15); c.drawCentredString(x + bw / 2, y - 33, str(v))
    y -= bh + 14

    # remarks
    style = ParagraphStyle('r', fontName=SANS, fontSize=10.2, leading=14.2, textColor=INK)
    import re
    text = re.sub(r'\s*\*\s*', ' | ', h['remarks']).strip(' |')   # MLS "*" bullets -> pipes
    para = Paragraph(text.replace('&', '&amp;').replace('<', '&lt;'), style)
    footer_top = M + 112
    aw, ah = para.wrap(W - 2 * M, y - footer_top - 8)
    para.drawOn(c, M, y - ah)

    # footer: agents (Lona first) + QR
    fy = M + 104
    c.setStrokeColorRGB(*ORANGE); c.setLineWidth(1.2); c.line(M, fy, W - M, fy)
    head = os.path.join(IMG, 'lona-headshot.png'), os.path.join(IMG, 'billy-headshot.png')
    agents = [('LONA KING', '(623) 203-6271', 'azlonaking@gmail.com', head[0]),
              ('BILLY HEINZMAN', '(480) 297-3830', 'billyheinzman@gmail.com', head[1])]
    ax = M
    for name, ph_, em, img in agents:
        if os.path.exists(img):
            c.drawImage(img, ax, M + 26, 58, 58, mask='auto', preserveAspectRatio=True)
        c.setFillColorRGB(*GREEN); c.setFont(SANSB, 11.5); c.drawString(ax + 66, M + 72, name)
        c.setFillColorRGB(*INK); c.setFont(SANS, 10); c.drawString(ax + 66, M + 57, 'Cell ' + ph_)
        c.setFillColorRGB(*ORANGE); c.setFont(SANS, 9); c.drawString(ax + 66, M + 43, em)
        ax += 200
    qx = W - M - 76
    c.drawImage(qr_image(h['url']), qx, M + 18, 76, 76)
    c.setFillColorRGB(*GREEN); c.setFont(SANSB, 8)
    c.drawRightString(qx - 8, M + 70, 'SCAN FOR')
    c.drawRightString(qx - 8, M + 60, 'MORE PHOTOS')
    c.drawRightString(qx - 8, M + 50, '& DETAILS')
    logo = os.path.join(IMG, 'homesmart-logo.png')
    if os.path.exists(logo):
        c.drawImage(logo, M, M + 4, 110, 17, mask='auto', preserveAspectRatio=True)
    c.setFillColorRGB(*MUTED); c.setFont(SANS, 6.8)
    c.drawString(M + 118, M + 10, 'www.hometownaz.com  |  Information deemed reliable but not guaranteed. Source: ARMLS. Equal Housing Opportunity.')
    c.showPage(); c.save()


def main():
    os.makedirs(OUT, exist_ok=True)
    designed = set()
    dpath = os.path.join(OUT, '_designed.txt')
    if os.path.exists(dpath):
        designed = {l.strip() for l in open(dpath) if l.strip() and not l.startswith('#')}
    homes = json.load(open(HOMES))
    made = 0
    for h in homes:
        if h.get('sold') or not h.get('photos') or h['slug'] in designed:
            continue
        flyer(h, os.path.join(OUT, h['slug'] + '.pdf'))
        made += 1
        print('  flyer:', h['slug'])
    print(f'build-flyers: {made} flyers written. Now run: node build-homes.js')


if __name__ == '__main__':
    main()
