import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERO_DIR = ROOT / "src" / "media" / "heroes"


class ProductionRasterHeroTests(unittest.TestCase):
    def test_production_pages_reference_webp_heroes(self):
        expected = {
            ROOT / "src" / "index.html": (
                "media/heroes/age-of-embers-hero.webp",
                "media/heroes/fatherless-original-hero.webp",
                "media/heroes/neurion-hero.webp",
            ),
            ROOT / "src" / "books" / "prequel" / "index.html": ("../../media/heroes/age-of-embers-hero.webp",),
            ROOT / "src" / "books" / "the-fatherless" / "index.html": ("../../media/heroes/fatherless-original-hero.webp",),
            ROOT / "src" / "books" / "sequel" / "index.html": ("../../media/heroes/neurion-hero.webp",),
        }
        for page, references in expected.items():
            text = page.read_text()
            self.assertNotIn("hero.svg", text, page)
            for reference in references:
                self.assertIn(reference, text, page)

    def test_retired_vector_and_seed_assets_are_absent(self):
        retired = (
            "age-of-embers-hero.svg",
            "fatherless-original-hero.svg",
            "neurion-hero.svg",
            "trilogy-overview-hero.svg",
        )
        for filename in retired:
            self.assertFalse((HERO_DIR / filename).exists(), filename)

        seed_dir = ROOT / "staging" / "raster-seed"
        self.assertFalse(seed_dir.exists(), "temporary raster seed staging must not remain in current source")

    def test_raster_hero_files_are_webp(self):
        for filename in (
            "age-of-embers-hero.webp",
            "fatherless-original-hero.webp",
            "neurion-hero.webp",
        ):
            data = (HERO_DIR / filename).read_bytes()
            self.assertGreater(len(data), 1024, filename)
            self.assertEqual(data[:4], b"RIFF", filename)
            self.assertEqual(data[8:12], b"WEBP", filename)
            self.assertNotIn(b"EXIF", data, filename)
            self.assertNotIn(b"XMP ", data, filename)


if __name__ == "__main__":
    unittest.main()
