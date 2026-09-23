# BOYD'S — launch checklist

Everything needed to take BOYD'S live, in order. Each step says **where** to do
it and **how to know it worked**. The detail behind each step is in
`docs/DEPLOYMENT.md`.

Do these on your own computer, in a Claude Code session opened in the
`Sennicare` folder (not `BOYDS`), with the Supabase MCP signed in.

Never paste a password, connection string or secret key into chat. Where one is
needed, you type it at a masked prompt or into a website's settings page.

---

## 1. Database

- [ ] **Preflight (read-only).** Ask Claude to run
      `BOYDS/scripts/preflight-production.sql` through the Supabase MCP.
      **Worked if:** no row says `STOP`, and "database state" says _clean_.
- [ ] **Apply the migrations.** In PowerShell, in the `BOYDS` folder, follow
      "From Windows" in `docs/DEPLOYMENT.md`: dry run first, then apply.
      Needs Node.js installed.
- [ ] **Verify (read-only).** Run `BOYDS/scripts/verify-production.sql` the same
      way as the preflight.
      **Worked if:** no row says `STOP`. "People and admins" will say _No admin
      yet_. That is expected; step 4 fixes it.

## 2. Supabase Auth settings (dashboard, once)

In Supabase → **Authentication**:

- [ ] **Sign In / Providers → Email:** turn **off** "Allow new users to sign up".
- [ ] **URL Configuration:** set **Site URL** to the website address, and add
      `<that address>/auth/confirm` to **Redirect URLs**. If the domain isn't
      ready, use the Vercel address from step 3 and update both later.
- [ ] **Emails → Templates → Invite user:** set the link to
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
- [ ] **Emails → Templates → Reset password:** set the link to
      `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

## 3. Website hosting (Vercel)

- [ ] Create a Vercel project from the GitHub repository, with **Root
      Directory** set to `BOYDS`.
- [ ] Add these environment variables (Supabase → Project Settings):
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY` (the secret one — **never** with
      `NEXT_PUBLIC_` in front), and `NEXT_PUBLIC_SITE_URL` (the website address).
- [ ] Deploy.
      **Worked if:** the home page loads, and `/command-centre` sends you to the
      sign-in page.

## 4. Your admin account

- [ ] Supabase → **Authentication → Users → Add user → Create new user**. Your
      email, a strong password of at least 12 characters, and tick **Auto
      Confirm User**.
- [ ] Ask Claude to run `BOYDS/scripts/bootstrap-first-admin.sql` with your
      details filled in. Your email is typed in at that moment and never saved
      into the code.
- [ ] Sign in at `<website>/sign-in`.
      **Worked if:** you land on the Command Centre and **Team** is in the menu.

## 5. The team

- [ ] **Team → Add a person** for Moh: first name _Moh_, role **Driver**, tick
      **A business partner** (_Field & Vehicle Operations Partner_) and
      **Drives for BOYD'S**, and leave the email blank.
      **Worked if:** his card says _Waiting for email_.
- [ ] When you have Moh's email: type it on his card and press **Save email**.
      He gets an invitation, sets a password, and lands in the driver app.
- [ ] Anyone else, whenever they join: same screen, same way.

## 6. Before real work starts

- [ ] Run `verify-production.sql` again.
      **Worked if:** no `STOP`, and "People and admins" shows at least one
      active admin.
- [ ] Take the first backup: `scripts/backup-database.sh` (`docs/DEPLOYMENT.md`
      → _Backups_). Store the file privately; it contains personal data.
- [ ] Enter BOYD-001's real details under **Vehicles**, and its running costs,
      so cost per mile can be calculated.
- [ ] Make the eight business decisions (`docs/SETUP.md`) as you're ready. The
      system reads _NOT CONFIGURED_ for each one until then, and never guesses.

---

**Not yet possible, and why:** there are no automated tests of a signed-in
session in a real browser, because they need this live project to run against.
Nothing alerts anyone to errors yet; that needs an account with a service like
Sentry. Server errors are still recorded in Vercel's logs.
