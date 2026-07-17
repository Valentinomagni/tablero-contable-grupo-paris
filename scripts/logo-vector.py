# Vectoriza el logo oficial (logo.jpg) a SVG REAL con potrace puro-Python (item 14, spec 21).
# Pipeline: upscale 4x LANCZOS -> umbral -> potrace (curvas Bezier) -> SVG con fill-rule
# evenodd (maneja el contraforma de la P), en blanco (fondos oscuros) y negro (claros).
# Uso: python scripts/logo-vector.py "C:/Users/Vmagni/Desktop/GRUPO PARIS/logo.jpg"
import sys, os
import numpy as np
import potrace
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else "../logo.jpg"
base = os.path.dirname(__file__)
out_dir = os.path.join(base, "..", "public", "brand")
os.makedirs(out_dir, exist_ok=True)

g = Image.open(src).convert("L")

def bbox(gray, umbral=60):
    return gray.point(lambda v: 255 if v > umbral else 0).getbbox()

bb = bbox(g); m = 4
lock = g.crop((max(bb[0]-m,0), max(bb[1]-m,0), min(bb[2]+m,g.width), min(bb[3]+m,g.height)))

# separar isotipo del texto por la franja horizontal vacía más grande
mask = lock.point(lambda v: 255 if v > 60 else 0)
filas = [any(mask.getpixel((x, y)) for x in range(0, mask.width, 2)) for y in range(mask.height)]
gaps, ini = [], None
for y, t in enumerate(filas):
    if not t and ini is None: ini = y
    if t and ini is not None: gaps.append((y - ini, ini, y)); ini = None
gaps = [x for x in gaps if x[1] > 4 and x[2] < mask.height - 4]
corte = max(gaps)[1] + max(gaps)[0] // 2 if gaps else mask.height
iso = lock.crop((0, 0, lock.width, corte)); iso = iso.crop(bbox(iso))

def path_d(curva_list, esc=1.0):
    """Convierte los paths de potrace a un solo atributo d (fill-rule evenodd une contornos y huecos)."""
    partes = []
    for curve in curva_list:
        s = curve.start_point
        partes.append(f"M{s.x*esc:.2f} {s.y*esc:.2f}")
        for seg in curve:
            e = seg.end_point
            if seg.is_corner:
                c = seg.c
                partes.append(f"L{c.x*esc:.2f} {c.y*esc:.2f}L{e.x*esc:.2f} {e.y*esc:.2f}")
            else:
                c1, c2 = seg.c1, seg.c2
                partes.append(f"C{c1.x*esc:.2f} {c1.y*esc:.2f} {c2.x*esc:.2f} {c2.y*esc:.2f} {e.x*esc:.2f} {e.y*esc:.2f}")
        partes.append("Z")
    return "".join(partes)

def vectorizar(gray, nombre, factor=4):
    up = gray.resize((gray.width*factor, gray.height*factor), Image.LANCZOS)
    # potracer traza el plano False como figura → invertimos: la tinta (blanco del
    # original) debe quedar en False para que el path resultante sea el glifo.
    bmp = (np.array(up) <= 128)
    trazo = potrace.Bitmap(bmp).trace(turdsize=25, opttolerance=0.25, alphamax=1.0)
    # de vuelta a coords del tamaño original para un viewBox chico
    esc = 1.0 / factor
    d = path_d(list(trazo), esc)
    w, h = gray.width, gray.height
    for color, sufijo in (("#FFFFFF", "-blanco"), ("#0B0B0D", "-negro")):
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
               f'<path d="{d}" fill="{color}" fill-rule="evenodd"/></svg>')
        with open(os.path.join(out_dir, nombre + sufijo + ".svg"), "w", encoding="utf-8") as f:
            f.write(svg)
    print(f"{nombre}: {len(d)//1024} KB de path, viewBox {w}x{h}")

vectorizar(lock, "lockup")
vectorizar(iso, "isotipo")
print("ok:", sorted(f for f in os.listdir(out_dir) if f.endswith(".svg")))
