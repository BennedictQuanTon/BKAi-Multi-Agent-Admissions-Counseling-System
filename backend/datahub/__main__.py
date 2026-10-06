"""CLI: python -m datahub [crawl|parse|validate|build|all]."""

from __future__ import annotations

import argparse
import asyncio
import json

from utils.logger import setup_logging


def main() -> None:
    parser = argparse.ArgumentParser(description="BKAi datahub")
    parser.add_argument("step", choices=["crawl", "parse", "validate", "build", "all"])
    parser.add_argument("--snapshot", default=None, help="snapshot folder name (default: today / latest)")
    args = parser.parse_args()
    setup_logging("INFO")

    if args.step in ("crawl", "all"):
        from datahub.crawl import crawl

        out = asyncio.run(crawl(args.snapshot))
        print(f"✓ crawl → {out}")

    if args.step in ("parse", "all"):
        from datahub.parse import parse_all

        stats = parse_all(args.snapshot)
        print("✓ parse →", json.dumps(stats, ensure_ascii=False))

    if args.step in ("validate", "all"):
        from datahub.validate import validate

        report = validate()
        print("✓ validate →", json.dumps(report["summary"], ensure_ascii=False))
        if report["summary"]["errors"]:
            raise SystemExit("validation failed — see data/build/validation_report.json")

    if args.step in ("build", "all"):
        from datahub.build import build

        manifest = build()
        print("✓ build →", json.dumps({k: manifest[k] for k in ("kb_version", "tables")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
