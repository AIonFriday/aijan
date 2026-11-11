-- MOCKUP ONLY. Sample faculty rows and the sessions added in production since 0004, so a local run of the faculty
-- pages has something to show. Never apply to aijan-db. Bios and roles in [brackets] are placeholders to swap for
-- the person's own words; the rest comes from their session descriptions and the links already on the site.

INSERT OR IGNORE INTO sessions (id, slug, title, description, status, starts_at, length_min, level, topics, guides, kind) VALUES
 ('map-it-before-you-automate-it','map-it-before-you-automate-it','Map it before you automate it','Bring one process that eats your week. We break it into steps, find where AI actually earns its keep, and map out a first version you can run yourself.','scheduled','2027-01-13T09:00:00-06:00',90,'all','["work"]','[{"name":"Brent McCrossen","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]','hands-on'),
 ('build-the-idea-you-keep-putting-off','build-the-idea-you-keep-putting-off','Build the idea you keep putting off','Bring the idea that''s been sitting in your notes (or in your head) for too long. We use AI to pressure-test it and sketch the idea, the customer, the value and the right words to test it with real people.','scheduled','2027-01-15T14:00:00-06:00',90,'all','["work","make"]','[{"name":"Brent McCrossen","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]','hands-on'),
 ('members-only-build-your-group-a-website-with-ai','members-only-build-your-group-a-website-with-ai','Members Only: Build Your Group a Website with AI','I’ll show you how I used AI to build a private website for my group, then help you start one for yours.','scheduled','2027-01-21T09:00:00-06:00',90,'sometimes','["make","work"]','[{"name":"Brook Davis"}]','hands-on'),
 ('my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos','my-brain-is-at-capacity-ai-for-work-life-and-everyday-chaos','My brain is at capacity: AI for everyday chaos','Too much going on? Same. Whitley shows the real ways she uses AI across work and home.','scheduled','2027-01-21T16:00:00-06:00',90,'all','["work","life"]','[{"name":"Whitley Rushing","url":"https://www.linkedin.com/in/whitley-rushing/"}]','talk');

INSERT OR IGNORE INTO faculty (slug, name, is_group, role, bio, links, projects, sort) VALUES
 ('ai-friday','AI Friday',1,'Monthly AI meetup in New Orleans',
  'A monthly morning meetup where people around New Orleans show what they’re building with AI. AI Friday kicks off the month and runs the office hours.',
  '[{"label":"Website","url":"https://aifri.day/"}]',
  '[{"name":"AI Friday meetups","about":"Demos and coffee, one Friday morning a month.","url":"https://aifri.day/"}]',10),
 ('brent-mccrossen','Brent McCrossen',0,'[Role, Company]',
  '[Short bio in Brent’s own words: what they do, and how AI shows up in their work.] Leading two hands-on sessions on turning a messy process or a stuck idea into something you can actually run.',
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/brent-mccrossen-4727225/"}]',
  '[{"name":"[Project name]","about":"[One line on something Brent is building or working on right now.]"}]',20),
 ('hello-gravel-krewe','Hello Gravel Krewe',1,'Game studio in New Orleans',
  'The team at Hello Gravel builds small games, and uses AI to go from idea to something playable fast. Bring an idea and leave with a game.',
  '[{"label":"Website","url":"https://hellogravel.com"}]',
  '[{"name":"Hello Gravel games","about":"Small games you can play in the browser.","url":"https://hellogravel.com/play"}]',30),
 ('whitley-rushing','Whitley Rushing',0,'[Role, Company]',
  'A working mom who manages a team, and uses AI across work and home: thinking out loud on the drive, planning hard conversations, tracking follow-ups, school reminders and recipes.',
  '[{"label":"LinkedIn","url":"https://www.linkedin.com/in/whitley-rushing/"}]',
  '[]',40),
 ('brook-davis','Brook Davis',0,'[Role, Company]',
  'Built a login-only website for a 31-person leadership class (member directory, profiles, session prep and feedback surveys) without writing the code by hand.',
  '[]',
  '[{"name":"Leadership class members site","about":"A private site for a 31-person class, built by describing it to AI."}]',50);
