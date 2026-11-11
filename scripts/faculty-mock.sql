-- MOCKUP ONLY. Faculty rows for a local run of the faculty pages (scripts/preview.mjs). Never apply to aijan-db.
-- Facts come from public pages: LinkedIn titles, hellogravel.com/about, dunn.us, revelry.co, Tulane's Hello Gravel
-- interview, and the session descriptions. Bios are drafts for each person to rewrite in their own words.
-- Photos live in site/assets/faculty/ (gitignored); scripts/preview.mjs downloads them. No photo = initials.

-- Sessions added in production since 0004, so the local lineup matches the live one.
INSERT OR IGNORE INTO sessions (id, slug, title, description, status, starts_at, length_min, level, topics, guides, kind) VALUES
 ('map-it-before-you-automate-it','map-it-before-you-automate-it','Map it before you automate it','Bring one process that eats your week. We break it into steps, find where AI actually earns its keep, and map out a first version you can run yourself.','scheduled','2027-01-13T09:00:00-06:00',90,'all','["work"]','[{"name":"Brent McCrossen","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]','hands-on'),
 ('build-the-idea-you-keep-putting-off','build-the-idea-you-keep-putting-off','Build the idea you keep putting off','Bring the idea that''s been sitting in your notes (or in your head) for too long. We use AI to pressure-test it and sketch the idea, the customer, the value and the right words to test it with real people.','scheduled','2027-01-15T14:00:00-06:00',90,'all','["work","make"]','[{"name":"Brent McCrossen","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]','hands-on'),
 ('members-only-build-your-group-a-website-with-ai','members-only-build-your-group-a-website-with-ai','Members Only: Build Your Group a Website with AI','I’ll show you how I used AI to build a private website for my group, then help you start one for yours.','scheduled','2027-01-21T09:00:00-06:00',90,'sometimes','["make","work"]','[{"name":"Brook Davis"}]','hands-on'),
 ('my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos','my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos','My brain is at capacity: AI for everyday chaos','Too much going on? Same. Whitley shows the real ways she uses AI across work and home.','scheduled','2027-01-21T16:00:00-06:00',90,'all','["work","life"]','[{"name":"Whitley Rushing","url":"https://www.linkedin.com/in/whitley-rushing/"}]','talk');
-- The faculty name is "Hello Gravel" now (production still says "Hello Gravel Krewe" on the session).
UPDATE sessions SET guides = '[{"name":"Hello Gravel","url":"https://hellogravel.com"}]' WHERE slug = 'build-a-game-with-ai';

INSERT OR IGNORE INTO faculty (slug, name, is_group, role, bio, photo, links, projects, sort) VALUES
 ('ai-friday','AI Friday',1,'Free monthly AI meetup in New Orleans',
  'Hosted by Andrew Dunn and Eli Ackerman. A free monthly morning meetup for people figuring out what they can do with AI. Beginners welcome, and you don’t need to be a developer. Come curious, leave with something to try. AI Friday kicks off AI January and runs its office hours.',
  '/assets/ai-friday-crawd.png',
  '[{"label":"Website","url":"https://aifri.day/"}]',
  '[{"name":"AI Friday meetups","about":"Demos, decks and recaps from every meeting are online.","url":"https://aifri.day/","image":"/assets/faculty/p-ai-friday.webp"}]',10),

 ('hello-gravel','Hello Gravel',1,'Online gravel delivery, from New Orleans',
  'Hello Gravel sells rocks on the internet: bulk gravel, stone, soil, sand and mulch, priced online and dropped by dump truck where you point. Started in New Orleans in 2023, with 15,000+ customers in all 50 states. The team builds a lot of it with AI, down to the games on the site.',
  '/assets/faculty/hello-gravel.png',
  '[{"label":"Website","url":"https://hellogravel.com"},{"label":"Instagram","url":"https://www.instagram.com/hellogravelofficial/"}]',
  '[{"name":"Hello Gravel games","about":"Yardmatch, The Delivery Game, Gravelyard Shift and more: free browser games that hand out discount codes.","url":"https://hellogravel.com/play/","image":"/assets/faculty/p-hello-gravel-games.png"},{"name":"HelloGravel.com","about":"Online ordering for bulk landscape materials, with delivered pricing by ZIP code.","url":"https://hellogravel.com","image":"/assets/faculty/p-hello-gravel-site.png"}]',20),

 ('brent-mccrossen','Brent McCrossen',0,'Chief Growth Officer, Revelry',
  'Leads revenue and product innovation at Revelry, the New Orleans software and AI studio, and has spent 20+ years in early-stage startups across tech, entertainment and travel (including co-founding Audiosocket). Leading two hands-on sessions on turning a messy process or a stuck idea into something you can run.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"},{"label":"Revelry","url":"https://revelry.co/"}]',
  '[{"name":"Revelry","about":"Custom software strategy, design and development, based in New Orleans since 2012.","url":"https://revelry.co/","image":"/assets/faculty/p-revelry.png"}]',30),

 ('whitley-rushing','Whitley Rushing',0,'Director of Operations, Hello Gravel',
  'Runs operations at Hello Gravel and leans on AI across work and home: thinking out loud on the drive, figuring out what her team should do next, planning hard conversations, tracking follow-ups, school reminders and recipes.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/whitley-rushing/"}]',
  '[]',40),

 ('brook-davis','Brook Davis',0,'COO and co-founder, Precon Playbook',
  'Strategy and product leader in New Orleans: COO and co-founder of Precon Playbook, COO at Align, and founder of Work in Tech. Built a login-only website for a 31-person leadership class (directory, profiles, session prep, feedback surveys) by describing it to AI.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/brookbissinger"}]',
  '[{"name":"Precon Playbook","about":"Co-founder and COO."},{"name":"Leadership class members site","about":"A private site for a 31-person class, built without writing the code by hand."}]',50),

 ('andrew-dunn','Andrew Dunn',0,'Building with AI at Hello Gravel · Organizer, AI Friday',
  'Co-hosts AI Friday. Lives in New Orleans and sells rocks on the internet at Hello Gravel. Nearly 20 years at New Orleans tech startups. These days: building with AI, and helping other people learn to build with it.',
  '/assets/faculty/andrew-dunn.jpg',
  '[{"label":"Website","url":"https://dunn.us/"},{"label":"LinkedIn","url":"https://www.linkedin.com/in/andrewdunn"},{"label":"GitHub","url":"https://github.com/andrewedunn"},{"label":"X","url":"https://x.com/DunnWithAI"}]',
  '[{"name":"Hallucinating Splines","about":"Micropolis (the open-source SimCity) as an API and MCP server, so AI agents can build and run public cities.","url":"https://hallucinatingsplines.com/","image":"/assets/faculty/p-hallucinating-splines.webp"},{"name":"See Dat","about":"Every public record about a New Orleans property on one page: permits, inspections, code enforcement, short-term rentals and zoning.","url":"https://seedat.dunn.us/","image":"/assets/faculty/p-seedat.webp"},{"name":"NOLA Art","about":"Every mural, sculpture and monument in New Orleans on one map.","url":"https://nolaart.dunn.us/","image":"/assets/faculty/p-nola-art.webp"},{"name":"Mardi Gras FYI","about":"The parade calendar, with times, routes and local advice.","url":"https://mardigras.fyi/","image":"/assets/faculty/p-mardi-gras-fyi.webp"}]',60),

 ('daniel-crowley','Daniel Crowley',0,'Co-founder and CEO, Hello Gravel',
  'Co-founded Hello Gravel in 2023 after years sourcing and hauling aggregates at Crowley Holdings, a government contracting company he started in 2016. Tulane grad who stayed in New Orleans.',
  NULL,
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/daniel-crowley-14709a108/"}]',
  '[{"name":"Crowley Holdings","about":"Aggregate supply and logistics for government contracts, 300+ projects across all 50 states."}]',70),

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
 ('laura-williams','Laura Williams',0,'[Role, Company]',
  '[Short bio in Laura’s own words.] Part of the AI Friday crew.',
  '/assets/faculty/laura-williams.jpg',
  '[]','[]',110),
 ('max-materne','Max Materne',0,'COO, RAVEN PMG',
  'Founded and ran New Orleans’ BMW, Ducati, Triumph and Vespa dealership with his family for 17 years. Now COO at RAVEN PMG and a co-host of The Dealer Lab podcast, about what dealers are learning from real experiments.',
  '/assets/faculty/max-materne.jpg',
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/max-materne"},{"label":"The Dealer Lab","url":"https://open.spotify.com/show/3diYz9Jpb00RFRbfYNBpA3"}]',
  '[{"name":"The Dealer Lab","about":"A podcast about the experiments and hard-earned lessons coming out of real dealerships.","url":"https://open.spotify.com/show/3diYz9Jpb00RFRbfYNBpA3"}]',120);

INSERT OR IGNORE INTO faculty_members (group_slug, person_slug, title, sort) VALUES
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
 ('hello-gravel','max-cannon',5);
