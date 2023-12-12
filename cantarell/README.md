# Cantarell
A more modern version of [Cantarell](https://wiki.gnome.org/Projects/CantarellFonts) for use in webfonts.

# About
Cantarell is a typeface designed primarily for user interfaces. In fact, this font has already been used as the default in the [GNOME Desktop Environment](https://gnome.org) for Linux, BSD, and other Unix-based operating systems.

The look and feel of Cantarell has been improved over the years. However, not all webfont hosting sites are catching up with that:

+ **Google Fonts** still [ships with earlier versions of Cantarell,](https://fonts.google.com/specimen/Cantarell#standard-styles) which are uglier than the current version (look at their bolds and italics).
* **Font Library**, despite including newer versions of it, [seem to forgot](https://fontlibrary.org/en/font/cantarell-v16) to add Cantarell Thin, Light, and ExtraBold which was latter introduced for newer versions of GNOME 3.

This repository is intended to host the latest versions of Cantarell (ripped from [Debian's `fonts-cantarell` package version 0.303-2](https://packages.debian.org/sid/fonts-cantarell)) for use in webfonts, CSS included. However, since the italic versions of Cantarell are no longer provided by default, I decided to create my own via [FontForge](https://fontforge.org).

This repository also follows the same directory and CSS conventions as in https://github.com/reinhart1010/aileron, hence all prebuilt CSS files are available under `https://reinhart1010.github.io/cantarell/` while individual font files reside in the `fonts/` directory. Please also note several differences between the full and lite versions:

+ [cantarell.css](https://reinhart1010.github.io/cantarell/cantarell.css) uses the full version of Cantarell fonts: OTF, TTF, SVG, EOT, WOFF and WOFF2. This is compatible with most browsers and browser versions, while the file may be large to be downloaded.
+ [cantarell.min.css](https://reinhart1010.github.io/cantarell/cantarell.min.css) is the minified version of [cantarell.css](https://reinhart1010.github.io/cantarell/cantarell.css).
+ [cantarell.lite.css](https://reinhart1010.github.io/cantarell/cantarell.lite.css) only uses the TTF, WOFF and WOFF2 formats, which is supported in more modern browsers.
+ [cantarell.lite.min.css](https://reinhart1010.github.io/cantarell/cantarell.lite.min.css) is the minified version of [cantarell.lite.css](https://reinhart1010.github.io/cantarell/cantarell.lite.css).

# License
This repository follows the same license, [SIL OFL 1.1](https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL), as the original font software. This repository also contain scripts which are licensed under MIT/Expat License.
