# Genera los assets de marca DESDE la imagen oficial (logo.jpg), sin redibujar nada:
# el negro se vuelve transparente y el blanco queda como tinta (alpha = luminancia).
# Salidas en public/brand/: lockup (isotipo + GRUPO PARIS) y isotipo solo, en blanco
# y en negro, con fondo transparente; más favicon y iconos PWA compuestos.
# Uso: python scripts/logo-from-jpg.py "C:/Users/Vmagni/Desktop/GRUPO PARIS/logo.jpg"
import sys, os
from PIL import Image, ImageDraw

src = sys.argv[1] if len(sys.argv) > 1 else "../logo.jpg"
out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "brand")
pub_dir = os.path.join(os.path.dirname(__file__), "..", "public")
os.makedirs(out_dir, exist_ok=True)

g = Image.open(src).convert("L")

def tinta(gray, color):
    """PNG transparente donde alpha = luminancia y el color es plano (blanco o negro)."""
    rgba = Image.new("RGBA", gray.size, color + (0,))
    rgba.putalpha(gray)
    return rgba

def bbox_blanco(gray, umbral=60):
    mask = gray.point(lambda v: 255 if v > umbral else 0)
    return mask.getbbox()

# --- lockup completo (isotipo + GRUPO PARIS), recortado al contenido con margen ---
bb = bbox_blanco(g)
m = 6
lock = g.crop((max(bb[0]-m,0), max(bb[1]-m,0), min(bb[2]+m,g.width), min(bb[3]+m,g.height)))
tinta(lock, (255,255,255)).save(os.path.join(out_dir, "lockup-blanco.png"))
tinta(lock, (11,11,13)).save(os.path.join(out_dir, "lockup-negro.png"))

# --- separar el isotipo del texto: buscar la franja horizontal vacía más grande ---
mask = lock.point(lambda v: 255 if v > 60 else 0)
filas_con_tinta = [any(mask.getpixel((x, y)) for x in range(0, mask.width, 2)) for y in range(mask.height)]
gaps, ini = [], None
for y, tiene in enumerate(filas_con_tinta):
    if not tiene and ini is None: ini = y
    if tiene and ini is not None: gaps.append((y - ini, ini, y)); ini = None
gaps = [x for x in gaps if x[1] > 4 and x[2] < mask.height - 4]  # ignorar bordes
corte = max(gaps)[1] + max(gaps)[0] // 2 if gaps else mask.height
iso = lock.crop((0, 0, lock.width, corte))
bi = bbox_blanco(iso)
iso = iso.crop((bi[0], bi[1], bi[2], bi[3]))
# cuadrar con padding transparente
lado = max(iso.size)
sq = Image.new("L", (lado, lado), 0)
sq.paste(iso, ((lado - iso.width)//2, (lado - iso.height)//2))
tinta(sq, (255,255,255)).save(os.path.join(out_dir, "isotipo-blanco.png"))
tinta(sq, (11,11,13)).save(os.path.join(out_dir, "isotipo-negro.png"))

# --- favicon y PWA: isotipo blanco REAL centrado sobre tile negro redondeado ---
def icono(px, radio_pct=0.22, escala=0.78):
    im = Image.new("RGBA", (px, px), (0,0,0,0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, px-1, px-1), radius=int(px*radio_pct), fill=(11,11,13,255))
    tam = int(px*escala)
    marca = tinta(sq.resize((tam,tam), Image.LANCZOS), (255,255,255))
    im.alpha_composite(marca, ((px-tam)//2, (px-tam)//2))
    return im

icono(64).save(os.path.join(pub_dir, "favicon.png"))
icono(192).save(os.path.join(pub_dir, "icon-192.png"))
icono(512).save(os.path.join(pub_dir, "icon-512.png"))
print("ok:", os.listdir(out_dir), "+ favicon.png, icon-192/512.png")
