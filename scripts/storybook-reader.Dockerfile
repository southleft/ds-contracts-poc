# THE STORYBOOK READER'S PINNED IMAGE (docs/GOAL.md Step 2; owner, 2026-11-01).
# A library that ships no fonts leaves the face to the platform, so the platform
# is pinned: Playwright's image for this checkout's playwright-core, by its
# linux/amd64 digest, with Liberation swapped for the metric-compatible Croscore
# faces (Arimo, Tinos, Cousine) that Figma lists from Google Fonts. Fontconfig's
# own metric aliases choose them; no alias is added here. Each font file is
# fetched from a pinned google/fonts commit and checked by SHA-256. Built locally
# by scripts/storybook-reader.ts; never pushed to a registry.
FROM mcr.microsoft.com/playwright:v1.61.1-noble@sha256:cf0daee9b994042e011bc29f20cdff1a9f682a039b43fcd738f7d8a9d3bcd9d6
RUN apt-get remove -y --purge fonts-liberation
ADD --checksum=sha256:e43898b143ec826ac8cb4034816458a7047fbe0836558de2a1f8c6223ae3e0ca https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/arimo/Arimo%5Bwght%5D.ttf /usr/share/fonts/truetype/croscore/Arimo[wght].ttf
ADD --checksum=sha256:a80fc54fd0233c1dfe298577c4d00f5ae81d5bb83510975e473c47e699b7f4ed https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/arimo/Arimo-Italic%5Bwght%5D.ttf /usr/share/fonts/truetype/croscore/Arimo-Italic[wght].ttf
ADD --checksum=sha256:60a0e8ef0c04dd5dd69ffe91025fa2ae5836cbd35600a82ba031977557e2cb61 https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/tinos/Tinos-Regular.ttf /usr/share/fonts/truetype/croscore/Tinos-Regular.ttf
ADD --checksum=sha256:393269dbab8899f938db19783eca5eac92eb431f7ae0ab45b8349ca895f1a06b https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/tinos/Tinos-Bold.ttf /usr/share/fonts/truetype/croscore/Tinos-Bold.ttf
ADD --checksum=sha256:5942266ed398b155d7dc23e36833e7ec6be988f2439bdbeb8ef1bede808eaa91 https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/tinos/Tinos-Italic.ttf /usr/share/fonts/truetype/croscore/Tinos-Italic.ttf
ADD --checksum=sha256:a5de79f0fe863ea0954757acb3d47b3ccd0a930ce3dd5b97230cd3866790a06e https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/tinos/Tinos-BoldItalic.ttf /usr/share/fonts/truetype/croscore/Tinos-BoldItalic.ttf
ADD --checksum=sha256:1da22250675fc4c42fcf3a9736c44bc0570516105331443b663fd5cfbd1412fe https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/cousine/Cousine-Regular.ttf /usr/share/fonts/truetype/croscore/Cousine-Regular.ttf
ADD --checksum=sha256:17c8a7245156d2253531c9e529474937b09d9f641c5ae7695c5e33f22822eef4 https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/cousine/Cousine-Bold.ttf /usr/share/fonts/truetype/croscore/Cousine-Bold.ttf
ADD --checksum=sha256:ea2a76ae3d0ece9cd59f0d30fdc08dd70e8f5f457beee5b0852a7b50c2286c7c https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/cousine/Cousine-Italic.ttf /usr/share/fonts/truetype/croscore/Cousine-Italic.ttf
ADD --checksum=sha256:848e858726fee0ae27b754e4cd6a2755209bf1428a8c91f747696d58c33906c3 https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec/ofl/cousine/Cousine-BoldItalic.ttf /usr/share/fonts/truetype/croscore/Cousine-BoldItalic.ttf
RUN chmod 644 /usr/share/fonts/truetype/croscore/* && fc-cache -f
