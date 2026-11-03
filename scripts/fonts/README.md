# Fonts for share images

`scripts/og.mjs` draws the share images with these fonts. They are the same families the site loads from Google Fonts, all under the SIL Open Font License (see the `OFL-*.txt` files).

| File | Source |
| --- | --- |
| `BricolageGrotesque-ExtraBold.ttf` | Static instance (wght 800, opsz 96) of the variable font, cut down to Latin |
| `AtkinsonHyperlegible-Regular.ttf`, `-Bold.ttf` | Cut down to Latin |
| `IBMPlexMono-SemiBold.ttf` | Unchanged |

The build only reads these files. To remake them (needs Python and `pip install fonttools`, not needed for normal work):

```sh
fonttools varLib.instancer "BricolageGrotesque[opsz,wdth,wght].ttf" wght=800 opsz=96 wdth=100 --static -o BricolageGrotesque-ExtraBold.ttf
U="U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026"
pyftsubset BricolageGrotesque-ExtraBold.ttf --unicodes="$U" --layout-features=kern --no-hinting --output-file=out.ttf
```

Characters outside that set show as "?" on the images. Add them to the subset if a title needs them.
