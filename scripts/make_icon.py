from PIL import Image, ImageDraw
import sys

# Draw at 4x for supersampling (natural antialiasing when scaled down)
SCALE = 4
S = 512 * SCALE

img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

NAVY = (13, 20, 45, 255)
GOLD = (215, 173, 62, 255)

def s(v): return int(v * SCALE)

# Background - rounded rectangle
margin = s(24)
radius = s(80)
x0, y0, x1, y1 = margin, margin, S - margin, S - margin

draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=NAVY)
draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=NAVY)
draw.ellipse([x0, y0, x0 + 2*radius, y0 + 2*radius], fill=NAVY)
draw.ellipse([x1 - 2*radius, y0, x1, y0 + 2*radius], fill=NAVY)
draw.ellipse([x0, y1 - 2*radius, x0 + 2*radius, y1], fill=NAVY)
draw.ellipse([x1 - 2*radius, y1 - 2*radius, x1, y1], fill=NAVY)

# === Scales of Justice ===
scx = s(256)

# Center post (vertical)
pw = s(13)
draw.rectangle([scx - pw//2, s(190), scx + pw//2, s(378)], fill=GOLD)

# Base plate
bw = s(82)
draw.rectangle([scx - bw, s(368), scx + bw, s(382)], fill=GOLD)
# Left foot
draw.rectangle([scx - bw, s(376), scx - bw + s(18), s(408)], fill=GOLD)
# Right foot
draw.rectangle([scx + bw - s(18), s(376), scx + bw, s(408)], fill=GOLD)

# Crossbeam (horizontal bar)
bary = s(202)
barh = s(11)
arm  = s(128)
draw.rectangle([scx - arm, bary, scx + arm, bary + barh], fill=GOLD)

# Center pivot (circle at top of post)
piv_r = s(15)
draw.ellipse([scx - piv_r, bary - piv_r + s(2),
              scx + piv_r, bary + piv_r + s(2)], fill=GOLD)

# Chain thickness
chain_w = s(6)

# Left chain + pan
lx    = scx - arm + s(6)
pan_y = s(285)
draw.line([lx, bary + barh, lx, pan_y], fill=GOLD, width=chain_w)
pw2 = s(58)
ph  = s(16)
draw.ellipse([lx - pw2, pan_y, lx + pw2, pan_y + ph], fill=GOLD)

# Right chain + pan
rx = scx + arm - s(6)
draw.line([rx, bary + barh, rx, pan_y], fill=GOLD, width=chain_w)
draw.ellipse([rx - pw2, pan_y, rx + pw2, pan_y + ph], fill=GOLD)

# Downscale for clean antialiasing
final = img.resize((512, 512), Image.LANCZOS)

base = r'C:\Users\chipp\Desktop\00-FILING-INBOX\LegalMind\legal_assistant_desktop\public'
final.save(f'{base}\\icon.png')

sizes = [(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)]
ico_imgs = [final.resize(sz, Image.LANCZOS) for sz in sizes]
ico_imgs[0].save(f'{base}\\icon.ico', format='ICO', sizes=sizes,
                 append_images=ico_imgs[1:])

print('Done! icon.png + icon.ico saved.')
