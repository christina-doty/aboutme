#!/usr/bin/env python3
"""
Build script for the static site.

Reads each project's YAML file from content/projects/ and renders
templates/base.html into a single flat index.html that GitHub Pages serves
as-is.

Usage:
    python build.py
"""

import shutil
from collections import Counter
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

ROOT = Path(__file__).parent
CONTENT_DIR = ROOT / "content" / "projects"
TEMPLATES_DIR = ROOT / "templates"
STATIC_DIR = ROOT / "static"
OUTPUT_DIR = ROOT / "dist"  # build output, never committed — uploaded as a Pages artifact by CI

SITE = {
    "name": "Jane Doe",
    "tagline": "Responsible AI · Bias & interpretability",
    "url": "https://mysite.com",
    "email": "jane@example.com",
    "linkedin": "https://www.linkedin.com/in/example",
    "linkedin_label": "linkedin.com/in/example",
    "orcid": "https://orcid.org/0000-0000-0000-0000",
    "orcid_label": "0000-0000-0000-0000",
}

# Category slug → the label shown on cards and in the legend.
# The matching accent colours live in static/styles.css.
CATEGORIES = {
    "responsible-ai": "Responsible AI",
    "data-viz": "Data viz & communication",
    "older": "Earlier work",
}

REQUIRED_FIELDS = {"title", "subtitle", "body", "category"}


def load_projects():
    """Load and validate every project YAML file."""
    projects = []

    for path in sorted(CONTENT_DIR.glob("*.yaml")):
        with open(path, "r", encoding="utf-8") as f:
            project = yaml.safe_load(f) or {}

        missing = REQUIRED_FIELDS - project.keys()
        if missing:
            raise ValueError(f"{path.name} is missing required fields: {sorted(missing)}")

        if project["category"] not in CATEGORIES:
            raise ValueError(
                f"{path.name} has unknown category {project['category']!r}. "
                f"Known categories: {sorted(CATEGORIES)}"
            )

        project["slug"] = path.stem
        projects.append(project)

    # Cards are displayed in one stack, ordered by their 'order' field
    # (defaults to 0), then by title for anything left tied.
    projects.sort(key=lambda p: (p.get("order", 0), p["title"]))

    return projects


def build():
    env = Environment(
        loader=FileSystemLoader(TEMPLATES_DIR),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("base.html")

    projects = load_projects()

    html = template.render(
        site=SITE,
        projects=projects,
        categories=CATEGORIES,
    )

    # fresh output dir each build
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True)

    (OUTPUT_DIR / "index.html").write_text(html, encoding="utf-8")

    # copy static assets (css/js/images) alongside the built HTML
    shutil.copytree(STATIC_DIR, OUTPUT_DIR / "static")

    counts = Counter(p["category"] for p in projects)
    print(f"Built {OUTPUT_DIR / 'index.html'} — {len(projects)} project(s)")
    for slug, label in CATEGORIES.items():
        print(f"  {label}: {counts.get(slug, 0)} project(s)")


if __name__ == "__main__":
    build()
