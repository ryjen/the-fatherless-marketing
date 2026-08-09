import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERO_DIR = ROOT / "src" / "media" / "heroes"
MASTER_DIR = ROOT / "staging" / "media-masters"


class ProductionRasterHeroTests(unittest.TestCase):
    def test_production_pages_use_responsive_picture_sources(self):
        expected = {
            ROOT / "src" / "index.html": (
                "media/heroes/age-of-embers-hero",
                "media/heroes/fatherless-original-hero",
                "media/heroes/neurion-hero",
            ),
            ROOT / "src" / "books" / "prequel" / "index.html": ("../../media/heroes/age-of-embers-hero",),
            ROOT / "src" / "books" / "the-fatherless" / "index.html": ("../../media/heroes/fatherless-original-hero",),
            ROOT / "src" / "books" / "sequel" / "index.html": ("../../media/heroes/neurion-hero",),
        }
        for page, prefixes in expected.items():
            text = page.read_text()
            self.assertIn("<picture>", text, page)
            self.assertNotIn("hero.svg", text, page)
            for prefix in prefixes:
                for width in (480, 960, 1440):
                    self.assertIn(f"{prefix}.{width}w.avif", text, page)
                    self.assertIn(f"{prefix}.{width}w.webp", text, page)

    def test_retired_vector_direct_raster_and_seed_assets_are_absent(self):
        retired = (
            "age-of-embers-hero.svg",
            "fatherless-original-hero.svg",
            "neurion-hero.svg",
            "trilogy-overview-hero.svg",
            "age-of-embers-hero.webp",
            "fatherless-original-hero.webp",
            "neurion-hero.webp",
        )
        for filename in retired:
            self.assertFalse((HERO_DIR / filename).exists(), filename)

        self.assertFalse(
            (ROOT / "staging" / "raster-seed").exists(),
            "temporary raster seed staging must not remain in current source",
        )

    def test_governed_raster_masters_are_clean_webp(self):
        for filename in (
            "age-of-embers-hero.webp",
            "fatherless-original-hero.webp",
            "neurion-hero.webp",
        ):
            data = (MASTER_DIR / filename).read_bytes()
            self.assertGreater(len(data), 1024, filename)
            self.assertEqual(data[:4], b"RIFF", filename)
            self.assertEqual(data[8:12], b"WEBP", filename)
            self.assertNotIn(b"EXIF", data, filename)
            self.assertNotIn(b"XMP ", data, filename)

    def test_alt_text_describes_visible_raster_content(self):
        prequel = (ROOT / "src" / "books" / "prequel" / "index.html").read_text()
        self.assertIn("dark glacial plain beneath jagged mountains", prequel)
        self.assertNotIn("low sun and red aurora", prequel)
        self.assertNotIn("protected ember", prequel)

        sequel = (ROOT / "src" / "books" / "sequel" / "index.html").read_text()
        self.assertIn("dark blue skyline of scattered lights", sequel)
        self.assertNotIn("synthetic persons move through", sequel)


if __name__ == "__main__":
    unittest.main()
