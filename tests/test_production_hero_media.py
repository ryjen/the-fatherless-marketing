import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ProductionHeroMediaTests(unittest.TestCase):
    def test_public_pages_use_raster_heroes(self):
        pages = [
            ROOT / 'src' / 'index.html',
            ROOT / 'src' / 'books' / 'prequel' / 'index.html',
            ROOT / 'src' / 'books' / 'the-fatherless' / 'index.html',
            ROOT / 'src' / 'books' / 'sequel' / 'index.html',
        ]
        combined = chr(10).join(page.read_text() for page in pages)
        self.assertNotIn('-hero.svg', combined)
        for name in ('age-of-embers-hero.webp', 'fatherless-original-hero.webp', 'neurion-hero.webp'):
            self.assertIn(name, combined)
            self.assertTrue((ROOT / 'src' / 'media' / 'heroes' / name).is_file())

    def test_retired_seed_and_vector_assets_are_absent(self):
        self.assertFalse((ROOT / 'staging' / 'raster-seed').exists())
        for name in ('trilogy-overview-hero.svg', 'age-of-embers-hero.svg', 'fatherless-original-hero.svg', 'neurion-hero.svg'):
            self.assertFalse((ROOT / 'src' / 'media' / 'heroes' / name).exists())


if __name__ == '__main__':
    unittest.main()
