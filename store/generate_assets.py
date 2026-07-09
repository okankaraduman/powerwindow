from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "store" / "assets"
SCREENSHOT_DIR = ASSET_DIR / "screenshots"

ASSET_DIR.mkdir(parents=True, exist_ok=True)
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

COLORS = {
    "bg": "#f7f8fa",
    "ink": "#111418",
    "muted": "#667085",
    "deep": "#121817",
    "accent": "#12836f",
    "accent_soft": "#e4f5f0",
    "gold": "#f2c84b",
    "line": "#dde3ea",
    "white": "#ffffff",
}


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, size, fill, bold=False, anchor=None):
    draw.text(xy, value, fill=fill, font=font(size, bold), anchor=anchor)


def lightning(draw, x, y, scale=1.0, fill=COLORS["gold"]):
    points = [
        (35, 6),
        (16, 36),
        (30, 36),
        (27, 58),
        (48, 24),
        (34, 24),
    ]
    draw.polygon([(x + px * scale, y + py * scale) for px, py in points], fill=fill)


def make_icon():
    img = Image.new("RGBA", (512, 512), COLORS["deep"])
    draw = ImageDraw.Draw(img)
    rounded(draw, (0, 0, 512, 512), 96, COLORS["deep"])
    lightning(draw, 42, 28, 6.8)
    img.save(ASSET_DIR / "icon-512.png")


def make_feature():
    img = Image.new("RGB", (1024, 500), COLORS["bg"])
    draw = ImageDraw.Draw(img)
    rounded(draw, (56, 56, 968, 444), 26, COLORS["deep"])
    rounded(draw, (96, 96, 170, 170), 18, "#0b100f")
    lightning(draw, 87, 86, 1.45)
    text(draw, (200, 104), "Power Window", 58, COLORS["white"], True)
    text(draw, (200, 170), "Find the cheapest hours for flexible electricity use in Spain.", 28, "#b9c6c0")
    text(draw, (96, 292), "2 PM-4 PM", 96, COLORS["white"], True)
    rounded(draw, (660, 292, 858, 344), 26, "#123e36", COLORS["accent"], 2)
    text(draw, (690, 306), "Live REE data", 24, "#8af0d3", True)
    text(draw, (664, 366), "Demo charger connector ready", 26, "#b9c6c0")
    img.save(ASSET_DIR / "feature-graphic.png")


def make_phone(path, title, main, subline, metrics):
    img = Image.new("RGB", (1080, 1920), COLORS["bg"])
    draw = ImageDraw.Draw(img)
    rounded(draw, (54, 54, 1026, 1866), 54, COLORS["white"], COLORS["line"], 2)
    rounded(draw, (88, 104, 162, 178), 18, COLORS["deep"])
    lightning(draw, 80, 95, 1.4)
    text(draw, (190, 112), "Power Window", 40, COLORS["ink"], True)
    text(draw, (190, 162), "Spain electricity timing planner", 24, COLORS["muted"])
    rounded(draw, (88, 252, 992, 858), 30, COLORS["deep"])
    text(draw, (128, 318), title, 28, "#aab4b0", True)
    text(draw, (128, 420), main, 100, COLORS["white"], True)
    text(draw, (128, 562), subline, 34, "#c7d0cc")
    rounded(draw, (128, 684, 382, 744), 30, "#123e36", COLORS["accent"], 2)
    text(draw, (158, 702), "Backend cache", 28, "#8af0d3", True)
    rounded(draw, (418, 684, 666, 744), 30, "#2b2514", COLORS["gold"], 2)
    text(draw, (448, 702), "Best window", 28, "#ffe391", True)

    for index, (label, value) in enumerate(metrics):
        y = 980 + index * 176
        rounded(draw, (88, y, 992, y + 134), 18, COLORS["white"], COLORS["line"], 2)
        text(draw, (124, y + 30), label, 28, COLORS["muted"], True)
        text(draw, (124, y + 76), value, 46, COLORS["ink"], True)

    rounded(draw, (88, 1546, 992, 1734), 22, COLORS["accent_soft"], "#b9ddd4", 2)
    text(draw, (124, 1588), "Plan flexible loads", 30, COLORS["accent"], True)
    text(draw, (124, 1642), "Dishwasher, laundry, EV charging, and demo smart-charging flow.", 28, COLORS["muted"])
    img.save(SCREENSHOT_DIR / path)


make_icon()
make_feature()
make_phone(
    "phone-01-planner.png",
    "Find the best power window",
    "2 PM-4 PM",
    "Live REE data",
    [("Timing grade", "A"), ("Estimated cost", "EUR 0.22"), ("Run now vs best", "Save EUR 1.64")],
)
make_phone(
    "phone-02-ev.png",
    "Plan EV charging by model",
    "Tesla Model 3",
    "Demo Wallbox ready",
    [("Battery", "50% -> 80%"), ("Charger", "7.4 kW"), ("Plan", "Send window")],
)
make_phone(
    "phone-03-mission.png",
    "See weekly timing impact",
    "EUR 15-20",
    "Example flexible-load week",
    [("Dishwasher", "2 runs"), ("Laundry", "1 load"), ("EV", "3-4 top-ups")],
)
