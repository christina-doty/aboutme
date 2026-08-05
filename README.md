# Personal site

Static single-page site. Jinja templates + project YAML in, one flat
`index.html` out, served by GitHub Pages.

## Build

```bash
pip install -r requirements.txt
python build.py          # writes dist/index.html + dist/static/
```

`dist/` is gitignored. The workflow in `.github/workflows/build.yml` runs the
build on every push to `main` and publishes `dist/` as a Pages artifact.

## Layout

```
templates/base.html          page shell: header, tab nav, four sections, footer
templates/project_card.html  one project card
content/projects/*.yaml      one file per project
static/styles.css            all styling; colour tokens at the top of the file
static/scripts.js            header shrink, tab nav, glint, share panel, ref logging
static/images/               placeholder art — swap for the real thing
build.py                     the renderer
```

## Adding a project

Drop a YAML file in `content/projects/`. Required: `title`, `subtitle`, `body`,
`category`. Optional: `image`, `image_alt`, `link`, `link_label`, `order`.

```yaml
title: Bias detection in hiring models
subtitle: Surfacing demographic disparities in candidate scoring
body: >
  A framework for surfacing demographic disparities in candidate
  scoring before deployment...
category: responsible-ai        # responsible-ai | data-viz | older
order: 10                       # lower sorts first, defaults to 0
image: images/bias-detection.png
link: https://github.com/you/bias-detection
```

Categories are declared once in `build.py` (`CATEGORIES`) and their accent
colours once in `styles.css`. An unknown category fails the build rather than
rendering an unstyled card.

## Before going live

- `COLLECT_ENDPOINT` in `static/scripts.js` — the Cloudflare Worker URL.
  Empty means no requests are sent, so the site is safe to deploy before the
  Worker exists.
