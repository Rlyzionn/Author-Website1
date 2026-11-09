"""Make the 1200x630 JPEG share cards in assets/og/ (what Facebook, LinkedIn,
X and iMessage show when a page is shared).

    python tools/share-cards.py

Run from the repository root after adding or changing a cover. Needs Pillow
(pip install pillow). Books without a card fall back to their cover image.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

W, H = 1200, 630
INK = (7, 7, 8)
BONE = (237, 231, 221)
GREY = (170, 164, 155)
OXBLOOD = (196, 20, 47)
SERIES = {
    'josh': 'A JOSH WILLIAMS NOVEL', 'hawk': 'A HAWK BENNETT NOVEL', 'true': 'TRUE CRIME',
    'dragon': 'THE LAST DRAGON', 'trail': 'THE APPALACHIAN TRAIL', 'kids': 'PICTURE BOOK',
}
FONTS = os.environ.get('WINDIR', 'C:/Windows') + '/Fonts/'


def font(name, size):
    for path in (FONTS + name, '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def backdrop():
    """Near-black with a soft oxblood glow, like the site's stage."""
    img = Image.new('RGB', (W, H), INK)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((620, -260, 1420, 540), fill=90)
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    img.paste(Image.new('RGB', (W, H), (60, 8, 16)), mask=glow)
    return img


def wrap(draw, text, fnt, width):
    lines, line = [], ''
    for word in text.split():
        test = (line + ' ' + word).strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def text_block(draw, x, y, label, title, sub):
    draw.text((x, y), label, font=font('seguisb.ttf', 22), fill=OXBLOOD, spacing=4)
    size = 76 if len(title) < 22 else 60
    tf = font('georgia.ttf', size)
    y += 52
    for line in wrap(draw, title, tf, 560)[:3]:
        draw.text((x, y), line, font=tf, fill=BONE)
        y += int(size * 1.08)
    y += 18
    draw.rectangle((x, y, x + 60, y + 2), fill=OXBLOOD)
    draw.text((x, y + 22), sub, font=font('segoeui.ttf', 26), fill=GREY)


def book_card(book, root):
    img = backdrop()
    draw = ImageDraw.Draw(img)
    cover = Image.open(os.path.join(root, book['cover'])).convert('RGB')
    cover = ImageOps.contain(cover, (360, 540), Image.LANCZOS)
    cx, cy = W - 120 - cover.width, (H - cover.height) // 2
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rectangle((cx + 18, cy + 26, cx + cover.width + 18, cy + cover.height + 26), fill=200)
    img.paste(Image.new('RGB', (W, H), (0, 0, 0)), mask=shadow.filter(ImageFilter.GaussianBlur(24)))
    img.paste(cover, (cx, cy))
    text_block(draw, 80, 150, SERIES.get(book['series'], ''), book['title'], 'by Joe Broadmeadow')
    return img


def portrait_card(root, label, title, sub):
    img = backdrop()
    draw = ImageDraw.Draw(img)
    photo = Image.open(os.path.join(root, 'assets', 'headshot-noir.jpg')).convert('RGB')
    photo = ImageOps.fit(photo, (380, 480), Image.LANCZOS, centering=(0.5, 0.35))
    px, py = W - 120 - 380, (H - 480) // 2
    draw.rectangle((px + 16, py + 16, px + 396, py + 496), outline=(80, 76, 72), width=2)
    img.paste(photo, (px, py))
    text_block(draw, 80, 160, label, title, sub)
    return img


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets', 'og')
    os.makedirs(out, exist_ok=True)
    save = lambda img, name: img.save(os.path.join(out, name + '.jpg'), 'JPEG', quality=84, optimize=True, progressive=True)
    with open(os.path.join(root, 'books.json'), encoding='utf-8') as f:
        books = json.load(f)
    for book in books:
        if book.get('cover') and os.path.exists(os.path.join(root, book['cover'])):
            save(book_card(book, root), book['id'])
            print('card', book['id'])
    save(portrait_card(root, 'CRIME FICTION, TRUE CRIME AND FANTASY', 'Stories forged in truth.', 'Joe Broadmeadow, retired police captain'), 'home')
    save(portrait_card(root, 'FROM THE DESK OF JOE BROADMEADOW', 'Joe’s blog', 'Essays, short fiction and observations'), 'blog')
    print('cards: home, blog')


if __name__ == '__main__':
    main()
