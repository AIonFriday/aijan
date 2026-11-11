-- MOCKUP ONLY. Faculty rows for a local run of the faculty pages (scripts/preview.mjs). Never apply to aijan-db.
-- Facts come from public pages: LinkedIn titles, hellogravel.com/about, dunn.us, revelry.co, Tulane's Hello Gravel
-- interview, and the session descriptions. Bios are drafts for each person to rewrite in their own words.
-- Photos live in site/assets/faculty/ (gitignored); scripts/preview.mjs downloads them. No photo = initials.

-- Sessions added in production since 0004, so the local lineup matches the live one.
INSERT OR IGNORE INTO sessions (id, slug, title, description, status, starts_at, length_min, level, topics, guides, kind) VALUES
 ('map-it-before-you-automate-it','map-it-before-you-automate-it','Map it before you automate it','Bring one process that eats your week. We break it into steps, find where AI actually earns its keep, and map out a first version you can run yourself.','scheduled','2027-01-13T09:00:00-06:00',90,'all','["work"]','[{"name":"Brent McCrossen","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]','hands-on'),
 ('build-the-idea-you-keep-putting-off','build-the-idea-you-keep-putting-off','Build the idea you keep putting off','Bring the idea that''s been sitting in your notes (or in your head) for too long. We use AI to pressure-test it and sketch the idea, the customer, the value and the right words to test it with real people.','scheduled','2027-01-15T14:00:00-06:00',90,'all','["work","make"]','[{"name":"Brent McCrossen","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]','hands-on'),
 ('members-only-build-your-group-a-website-with-ai','members-only-build-your-group-a-website-with-ai','Members Only: Build Your Group a Website with AI','I’ll show you how I used AI to build a private website for my group, then help you start one for yours.','scheduled','2027-01-21T09:00:00-06:00',90,'sometimes','["make","work"]','[{"name":"Brook Davis"}]','hands-on'),
 ('my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos','my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos','My brain is at capacity: AI for everyday chaos','Too much going on? Same. Whitley shows the real ways she uses AI across work and home.','scheduled','2027-01-21T16:00:00-06:00',90,'all','["work","life"]','[{"name":"Whitley Rushing","url":"https://www.linkedin.com/in/whitley-rushing/"}]','talk'),
 ('grind-to-market','grind-to-market','Grind to Market: AI killed the MVP. Now what?','Building with AI is cheap now, so the hard part is finding customers. Rob Gaudet of Startup Grind New Orleans makes the case for spending 65% of your time on selling and 35% on building. After a short talk, you''ll map where your customers already gather and leave with one simple test to run there that week.','scheduled','2027-01-14T11:30:00-06:00',90,'all','["work"]','[{"name":"Rob Gaudet","url":"https://www.linkedin.com/in/robgaudet/"}]','hands-on');
-- The faculty name is "Hello Gravel" now (production still says "Hello Gravel Krewe" on the session).
UPDATE sessions SET guides = '[{"name":"Hello Gravel","url":"https://hellogravel.com"}]' WHERE slug = 'build-a-game-with-ai';

INSERT OR IGNORE INTO faculty (slug, name, is_group, role, bio, photo, links, projects, sort) VALUES
 ('ai-friday','AI Friday',1,'Free monthly AI meetup in New Orleans',
  'Hosted by Andrew Dunn and Eli Ackerman. A free monthly morning meetup for people figuring out what they can do with AI. Beginners welcome, and you don’t need to be a developer. Come curious, leave with something to try. AI Friday kicks off AI January and runs its office hours.',
  '/assets/ai-friday-crawd.png',
  '[{"label":"Website","url":"https://aifri.day/"}]',
  '[{"name": "AI Friday meetups", "about": "Demos, decks and recaps from every meeting are online.", "url": "https://aifri.day/", "image": "/assets/faculty/p-ai-friday.webp"}]',10),

 ('hello-gravel','Hello Gravel',1,'Online gravel delivery, from New Orleans',
  'Hello Gravel sells rocks on the internet: bulk gravel, stone, soil, sand and mulch, priced online and dropped by dump truck where you point. Started in New Orleans in 2023, with 15,000+ customers in all 50 states. The team builds a lot of it with AI, down to the games on the site.',
  '/assets/faculty/hello-gravel.png',
  '[{"label":"Website","url":"https://hellogravel.com"},{"label":"Instagram","url":"https://www.instagram.com/hellogravelofficial/"}]',
  '[{"name": "Hello Gravel games", "about": "Yardmatch, The Delivery Game, Gravelyard Shift and more: free browser games that hand out discount codes.", "url": "https://hellogravel.com/play/", "image": "/assets/faculty/p-hello-gravel-games.png"}, {"name": "Measure the Driveway", "about": "Trace your driveway on a satellite map and see its size, how many tons of gravel to order, and a delivered price. Free, no signup.", "url": "https://measurethedriveway.com/", "image": "/assets/faculty/p-measure-the-driveway.png"}, {"name": "HelloGravel.com", "about": "Online ordering for bulk landscape materials, with delivered pricing by ZIP code.", "url": "https://hellogravel.com", "image": "/assets/faculty/p-hello-gravel-site.png"}]',20),

 ('brent-mccrossen','Brent McCrossen',0,'Founder, Mortise Advisors',
  'Founder of Mortise Advisors, where he works on go-to-market and applied AI. Has spent 20+ years in early-stage startups across tech, entertainment and travel (including co-founding Audiosocket). Leading two hands-on sessions on turning a messy process or a stuck idea into something you can run.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]',
  '[]',30),

 ('whitley-rushing','Whitley Rushing',0,'Director of Operations, Hello Gravel',
  'Runs operations at Hello Gravel and leans on AI across work and home: thinking out loud on the drive, figuring out what her team should do next, planning hard conversations, tracking follow-ups, school reminders and recipes.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/whitley-rushing/"}]',
  '[]',40),

 ('brook-davis','Brook Davis',0,'COO, Precon Playbook',
  'Strategy and product leader in New Orleans: COO and co-founder of Precon Playbook, COO at Align, and founder of Work in Tech. Built a login-only website for a 31-person leadership class (directory, profiles, session prep, feedback surveys) by describing it to AI.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/brookbissinger"}]',
  '[{"name": "Sipped", "about": "Remembers what your people drink, so you always bring the right bottle. Free, in your browser.", "url": "https://www.mysipped.com/", "image": "/assets/faculty/p-sipped.png"}, {"name": "Precon Playbook", "about": "Software that helps building owners keep big construction projects on track before ground breaks.", "url": "https://www.preconplaybook.com/", "image": "/assets/faculty/p-precon-playbook.webp"}]',50),

 ('andrew-dunn','Andrew Dunn',0,'AI Builder',
  'Co-hosts AI Friday. Lives in New Orleans and sells rocks on the internet at Hello Gravel. Nearly 20 years at New Orleans tech startups. These days: building with AI, and helping other people learn to build with it.',
  '/assets/faculty/andrew-dunn.jpg',
  '[{"label":"Website","url":"https://dunn.us/"},{"label":"LinkedIn","url":"https://www.linkedin.com/in/andrewdunn"},{"label":"GitHub","url":"https://github.com/andrewedunn"},{"label":"X","url":"https://x.com/DunnWithAI"}]',
  '[{"name": "Hallucinating Splines", "about": "Micropolis (the open-source SimCity) as an API and MCP server, so AI agents can build and run public cities.", "url": "https://hallucinatingsplines.com/", "image": "/assets/faculty/p-hallucinating-splines.webp"}, {"name": "See Dat", "about": "Every public record about a New Orleans property on one page: permits, inspections, code enforcement, short-term rentals and zoning.", "url": "https://seedat.dunn.us/", "image": "/assets/faculty/p-seedat.webp"}, {"name": "NOLA Art", "about": "Every mural, sculpture and monument in New Orleans on one map, with walks and stories.", "url": "https://nolaart.dunn.us/", "image": "/assets/faculty/p-nola-art.webp"}, {"name": "Mardi Gras FYI", "about": "The New Orleans parade calendar, with times, routes and practical local advice.", "url": "https://mardigras.fyi/", "image": "/assets/faculty/p-mardi-gras-fyi.webp"}, {"name": "CFB Homecoming", "about": "Maps and team histories showing where college football rosters come from, and how far from home they’ve moved since 1986.", "url": "https://cfbhomecoming.com/", "image": "/assets/faculty/p-cfb-homecoming.webp"}, {"name": "Pick Yeah", "about": "Sports pick’em with friends. One group for every sport, with standings that keep going all year.", "url": "https://pickyeah.com/", "image": "/assets/faculty/p-pick-yeah.webp"}, {"name": "Roux Wars", "about": "A browser game: cook three roux to the color on the card. Don’t burn it.", "url": "https://roux.dunn.us/", "image": "/assets/faculty/p-roux-wars.webp"}, {"name": "Is Mardi Gras early?", "about": "A tiny site that answers an important New Orleans question.", "url": "https://ismardigrasearly.com/", "image": "/assets/faculty/p-is-mardi-gras-early.webp"}, {"name": "Battlefield First Edition", "about": "A game a 9-year-old designed and vibe coded with Claude, with Andrew coaching how to talk to it.", "url": "https://andrewedunn.github.io/battlefield-first-edition/", "image": "/assets/faculty/p-battlefield.webp"}]',60),

 ('daniel-crowley','Daniel Crowley',0,'Co-founder and CEO, Hello Gravel',
  'Co-founded Hello Gravel in 2023 after years sourcing and hauling aggregates at Crowley Holdings, a government contracting company he started in 2016. Tulane grad who stayed in New Orleans.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/daniel-crowley-14709a108/"}]',
  '[]',70),

 ('michael-brubaker','Michael Brubaker',0,'Head of Sales and Ops, Hello Gravel',
  'Leads sales and operations at Hello Gravel. Tulane Freeman School grad.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/mebrubaker"}]',
  '[]',80),

 ('max-cannon','Max Cannon',0,'Sales Manager, Hello Gravel',
  'Sells rocks at Hello Gravel. UNO grad, with earlier work at SITECH Louisiana.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/maxcannoniv"}]',
  '[]',90);

INSERT OR IGNORE INTO faculty (slug, name, is_group, role, bio, photo, links, projects, sort) VALUES
 ('eli-ackerman','Eli Ackerman',0,'Head of Operations and Partnerships, RentCheck',
  'Co-hosts AI Friday. Runs operations and partnerships at RentCheck, the New Orleans property-inspection software company. Columbia SIPA grad.',
  '/assets/faculty/eli-ackerman.jpg',
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/eliackerman"}]',
  '[]',100),
 ('laura-williams','Laura Williams',0,'Product builder',
  'Writes the spec, designs it and ships the build. Makes small, useful, sometimes weird products, from sprint tools to a periodic table of Taylor Swift songs. Part of the AI Friday crew.',
  '/assets/faculty/laura-williams.jpg',
  '[{"label":"Website","url":"https://hosette.net/"}]',
  '[{"name": "SPF", "about": "A sprint planner that shows this sprint and next side by side.", "url": "https://spf.hosette.net/", "image": "/assets/faculty/p-spf.webp"}, {"name": "Celine AI", "about": "An experiment: a lien-rights chat for suppliers that shows the law next to your account.", "url": "https://hosette.net/projects/celine", "image": "/assets/faculty/p-celine.webp"}, {"name": "Periodic Table of Taylor Swift", "about": "283 songs, mapped like elements by era and feeling.", "url": "https://ts.hosette.net/", "image": "/assets/faculty/p-taylor-swift.webp"}, {"name": "[g]host in the transcripts", "about": "A portrait of Lenny Rachitsky built from 298 of his own transcripts.", "url": "https://hosette.net/projects/ghost-in-the-transcripts", "image": "/assets/faculty/p-ghost-transcripts.webp"}, {"name": "Jazz Hands", "about": "Play jazz-ish chords with your hands and face through your webcam.", "url": "https://hosette.net/projects/jazz-hands", "image": "/assets/faculty/p-jazz-hands.webp"}, {"name": "Pixted", "about": "A craft tool for her young nephew, named in his words.", "url": "https://hosette.net/projects/pixted", "image": "/assets/faculty/p-pixted.webp"}, {"name": "Omunikorudo", "about": "A browser version of the Suzuki Omnichord.", "url": "https://hosette.net/projects/omnichord", "image": "/assets/faculty/p-omnichord.webp"}, {"name": "Pocketbook", "about": "An archive her grandmother can rummage through.", "url": "https://hosette.net/projects/pocketbook", "image": "/assets/faculty/p-pocketbook.webp"}, {"name": "Guestbook for AI agents", "about": "A sign-in page for AI agents: an invitation, not a CAPTCHA.", "url": "https://hosette.net/projects/guestbook", "image": "/assets/faculty/p-guestbook.webp"}, {"name": "Office Hours", "about": "A dashboard for friends across time zones.", "url": "https://hosette.net/projects/oh", "image": "/assets/faculty/p-office-hours.webp"}, {"name": "GardenIQ", "about": "A garden planner that explains why, not just what.", "url": "https://hosette.net/projects/gardeniq", "image": "/assets/faculty/p-gardeniq.webp"}, {"name": "More on hosette.net", "about": "Sixteen projects and counting.", "url": "https://hosette.net/#projects", "image": "/assets/faculty/p-hosette.webp"}]',110),
 ('max-materne','Max Materne',0,'COO, RAVEN PMG',
  'Founded and ran New Orleans’ BMW, Ducati, Triumph and Vespa dealership with his family for 17 years. Now COO at RAVEN PMG and a co-host of The Dealer Lab podcast, about what dealers are learning from real experiments.',
  '/assets/faculty/max-materne.jpg',
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/max-materne"},{"label":"The Dealer Lab","url":"https://open.spotify.com/show/3diYz9Jpb00RFRbfYNBpA3"}]',
  '[{"name": "The Dealer Lab", "about": "A podcast about the experiments and hard-earned lessons coming out of real dealerships.", "url": "https://open.spotify.com/show/3diYz9Jpb00RFRbfYNBpA3", "image": "/assets/faculty/p-dealer-lab.webp"}]',120);

INSERT OR IGNORE INTO faculty (slug, name, is_group, role, bio, photo, links, projects, sort) VALUES
 ('chris-andrews','Chris Andrews',0,'Software development leader, Hello Gravel',
  'Software development leader. Joined Hello Gravel as a senior engineer in 2026, after building software at Selected and elsewhere.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/christopher-andrews-2229068"}]',
  '[]',95),
 ('rob-gaudet','Rob Gaudet',0,'Startup Grind New Orleans',
  'Runs Startup Grind New Orleans. Thinks the hard part of building with AI is now finding customers, not writing code.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/robgaudet/"}]',
  '[{"name": "Startup Grind New Orleans", "about": "The New Orleans chapter of the global founder community.", "url": "https://www.startupgrind.com/new-orleans/", "image": "/assets/faculty/p-startup-grind.webp"}]',35),
 ('tim-williamson','Tim Williamson',0,'Co-founder, NieuxCo',
  'New Orleans native who has spent 25 years building the city’s startup scene. Led NOLA Media Group (The Times-Picayune and NOLA.com) and founded 504GOOD. Co-founded NieuxCo, the venture studio behind Nieux Society, and opened The Nieux to the city for AI January.',
  '/assets/faculty/tim-williamson.jpg',
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/timhwilliamson"},{"label":"The Nieux","url":"https://thenieux.com/"},{"label":"Nieux Society","url":"https://www.nieuxsociety.com/"}]',
  '[{"name": "Nieux Society", "about": "A New Orleans collective for people curious about what’s next: events, a weekly email and a community.", "url": "https://www.nieuxsociety.com/", "image": "/assets/faculty/p-nieux-society.webp"}, {"name": "504GOOD", "about": "A nonprofit driving innovation in New Orleans. Tim is founder and chairman.", "url": "https://504good.org/", "image": "/assets/faculty/p-504good.webp"}]',3),
 ('the-nieux','The Nieux',1,'Home of AI January · 2040 St. Charles Ave',
  'Nieux Society’s space in the Eiffel Tower building on St. Charles Avenue. Most AI January sessions happen here, all month, for free.',
  '/assets/nieux-crown.png',
  '[{"label":"Nieux Society","url":"https://www.nieuxsociety.com/"}]',
  '[]',4);

INSERT OR IGNORE INTO faculty_members (group_slug, person_slug, title, sort) VALUES
 ('the-nieux','tim-williamson','Founder',1),
 ('ai-friday','andrew-dunn','Host',1),
 ('ai-friday','eli-ackerman','Host',2),
 ('ai-friday','laura-williams','',3),
 ('ai-friday','max-materne','',4),
 ('ai-friday','brook-davis','',5);

INSERT OR IGNORE INTO faculty_members (group_slug, person_slug, sort) VALUES
 ('hello-gravel','daniel-crowley',1),
 ('hello-gravel','andrew-dunn',2),
 ('hello-gravel','michael-brubaker',3),
 ('hello-gravel','whitley-rushing',4),
 ('hello-gravel','chris-andrews',5),
 ('hello-gravel','max-cannon',6);

-- On the home strip and /faculty without a session of their own (Andrew's call).
UPDATE faculty SET featured = 1 WHERE slug IN ('andrew-dunn', 'eli-ackerman', 'tim-williamson', 'the-nieux');
