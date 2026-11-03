# AI January

Free, practical AI learning in New Orleans, **January 8–28, 2027**. Three weeks of workshops, office hours, and conversations, mostly at The Nieux (2040 St. Charles Ave). Beginners welcome, and there's something for every level.

Presented by [The Nieux Society](https://www.nieuxsociety.com/) and [AI Friday](https://aifri.day/).

This repo is the website: a list of sessions people can RSVP to, ideas people can say "I want this" to, a page for offering to guide a session, and a page for bringing your own group (your "krewe").

> **Status:** working mockup. The sessions in `data/sessions.json` are examples, and the buttons don't save anything yet. Sign-in, RSVPs and the database are next. See [docs/roadmap.md](docs/roadmap.md).

## How it works

- **Scheduled sessions** have a date. People RSVP.
- **Ideas** don't have a date yet. People tap "I want this". Once five people want one and a guide signs up, an organizer schedules it.
- **Anyone can suggest an idea.** Organizers review every suggestion before it shows up.
- **Guides** sit next to people and help. No slides, no presentation. A guide can be a person or a group ("Guided by the AI Friday crew"). Organizers approve guides.
- **Bring your krewe:** a team, congregation, class or block asks for its own session, and we match it with a guide.

## Run it locally

You need Node 20 or newer.

```sh
npm install
npm run build     # writes the site to dist/
npm run dev       # serves it with the Worker at http://localhost:8787
```

`npm run check` validates the session data and checks every link in the build. Run it before you open a pull request.

Deploys happen only through GitHub: merging to `main` publishes the site through Cloudflare Workers Builds, and every branch gets a preview link. See [docs/architecture.md](docs/architecture.md#deploys).

## What's where

```
data/sessions.json      the sessions (examples for now)
site/pages/             home, guide, krewe and 404 pages
site/templates/         the page template used for every session
site/partials/          shared <head>, header, footer and sign-in sheet
site/assets/            CSS, JavaScript, logos, map data
scripts/build.mjs       builds dist/ from the above (no dependencies)
scripts/check-html.mjs  checks the build for broken links
src/worker.js           the Cloudflare Worker (serves dist/, future /api)
docs/                   architecture, data model, design rules, auth plan
```

## Contributing

Pull requests are welcome, from fixing a typo to building a feature. Start with [CONTRIBUTING.md](CONTRIBUTING.md). If you're using an AI coding agent, point it at [AGENTS.md](AGENTS.md).

## Credits

Street map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database License.

Code is MIT licensed. See [LICENSE](LICENSE).
