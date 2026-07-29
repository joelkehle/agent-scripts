#!/usr/bin/env python3

import json
import tempfile
import unittest
from pathlib import Path

from clean_canvas_check import check


class CleanCanvasCheckTest(unittest.TestCase):
    def make_case(self, product="Ask a question", review="Facilitator only"):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        (root / "product.html").write_text(product, encoding="utf-8")
        (root / "review.html").write_text(review, encoding="utf-8")
        manifest = root / "manifest.json"
        manifest.write_text(
            json.dumps(
                {
                    "schema": 1,
                    "product_files": ["product.html"],
                    "review_files": ["review.html"],
                    "required_review_text": ["Facilitator only"],
                }
            ),
            encoding="utf-8",
        )
        self.addCleanup(temporary.cleanup)
        return root, manifest

    def test_clean_separation_passes(self):
        _, manifest = self.make_case()
        self.assertEqual(check(manifest)[0], "clean-canvas=pass")

    def test_review_language_in_product_fails(self):
        _, manifest = self.make_case(product="Design preview")
        with self.assertRaisesRegex(ValueError, "leaked"):
            check(manifest)

    def test_missing_review_contract_fails(self):
        _, manifest = self.make_case(review="Notes")
        with self.assertRaisesRegex(ValueError, "missing required"):
            check(manifest)

    def test_overlapping_files_fail(self):
        root, manifest = self.make_case()
        data = json.loads(manifest.read_text(encoding="utf-8"))
        data["review_files"] = ["product.html"]
        manifest.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "overlap"):
            check(manifest)


if __name__ == "__main__":
    unittest.main()
