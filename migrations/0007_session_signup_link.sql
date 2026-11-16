-- A session run by someone else (a partner event, like the Hack Dat hackathon) takes sign-ups on its own site.
-- signup_url holds that address: the session's buttons send people there instead of saving an RSVP here.
-- Empty means people RSVP on this site, as before. Apply to aijan-db by hand before the PR merges.
ALTER TABLE sessions ADD COLUMN signup_url TEXT;
