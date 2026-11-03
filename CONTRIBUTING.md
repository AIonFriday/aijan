# Contributing to AI January

Thanks for helping. This site is built by volunteers for a free community event, so small, clear pull requests are the most useful kind.

## Good first contributions

- Fix wording that would confuse a beginner.
- Improve how a page works on a phone.
- Accessibility fixes: focus states, labels, contrast, screen reader text.
- Pick up an item from [docs/roadmap.md](docs/roadmap.md) or an issue labeled `good first issue`.

If you want to build something bigger, open an issue first so we can agree on the approach.

## Setup

```sh
git clone https://github.com/AIonFriday/aijan
cd aijan
npm install
npm run build
npm run dev   # http://localhost:8787
```

You need Node 20 or newer. No Cloudflare account is needed to run it locally.

## Making a change

1. Fork the repo and create a branch: `git checkout -b fix-guide-form-labels`.
2. Make your change. Read [AGENTS.md](AGENTS.md) for the rules (design, words, code). They apply to people too.
3. Run `npm run build && npm run check`.
4. Look at your change at phone width (390px) and desktop width.
5. Open a pull request using the template. Add screenshots for anything visual.

## Adding or editing example sessions

Sessions live in `data/sessions.json`. Each one needs:

| Field | Example | Notes |
| --- | --- | --- |
| `slug` | `ai-for-your-restaurant` | Lowercase words and hyphens. Never change it once shared. |
| `title` | `AI for your restaurant` | Short and plain. |
| `description` | `Write menu descriptions…` | One or two sentences. |
| `status` | `scheduled` | `proposed` (an idea), `scheduled`, or `cancelled`. |
| `startsAt` | `2027-01-13T11:30:00-06:00` | Required when scheduled. Include the offset. |
| `level` | `new` | `all`, `new`, `sometimes`, `daily`, `build`. |
| `topics` | `["work"]` | Any of `work`, `life`, `make`, `curious`. |
| `guides` | `["Dee"]` | People or group names. Empty list means it needs a guide. |
| `count` | `9` | RSVPs if scheduled, "I want this" if proposed. |

Optional: `tags`, `location` (defaults to The Nieux), `officeHours`, `visible` (set `false` to hide).

`npm run check` tells you if something is off.

## Code of conduct

Be kind, especially to beginners. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree your contribution is licensed under the MIT License in [LICENSE](LICENSE).
