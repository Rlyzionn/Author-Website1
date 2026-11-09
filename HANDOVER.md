# Your website: how it works and how to update it

Joe, this is everything you need to keep the site up to date. Nothing here needs any technical knowledge.

**Your site:** https://author-website1-eight.vercel.app (your own domain can be connected, see the last section)

---

## 1. Blog posts: nothing changes

Keep writing in WordPress exactly as you do now.

- Publish a post as usual at https://joebroadmeadowblog.com/wp-admin/
- Within about 10 minutes it appears on the website by itself: in the "From Joe's desk" strip at the top of the homepage, in "Latest writing", and on the Blog page.
- Readers who click a post read it on your WordPress blog, so comments, subscriptions and your old links all keep working.
- Only **public** posts are shown. Drafts and private posts never appear.

---

## 2. Books: add, edit or remove

You manage your books in a simple form called **Pages CMS**. You don't need a GitHub account: you'll get an email invitation.

**Sign in**

1. Open the invitation email from Pages CMS and follow the link (or go to https://app.pagescms.org and sign in with the same email).
2. Choose **Author-Website1**, then **Books** in the menu.

You'll see every book in the order it appears on the site. Each one opens into a form.

**Change a buying link, description or title**

1. Open the book.
2. Edit the field. Each field has a short note underneath explaining what it's for.
3. Click **Save**.

**Add a new book**

1. Click **Add an entry** at the bottom of the list.
2. Fill in at least: **Title**, **Series**, **Web address name**, **One-line hook** and **Description**.
   - *Web address name*: a short lowercase name for the book's page, for example `widow-makers-guild`. Its page becomes `/books/widow-makers-guild/`.
3. Add the **Cover image** and **Amazon link** if you have them. You can add them later.
4. Click **Save**.

**Change a cover**

1. Open the book and click the **Cover image** field.
2. Upload the new image: the front cover only, about 1,000 pixels wide, in WebP or JPEG.
3. Click **Save**.

**Change the order** by dragging books up or down in the list. **Remove a book** with the delete button on its entry.

**After you save**

The website updates itself in about a minute. Refresh the page to see the change.

**If something goes wrong**

If a change has a mistake in it (for example two books with the same web address name, or no series chosen), the site simply keeps showing the previous version until it's fixed. Nothing breaks for your readers. Correct the field and save again, or send us a note.

---

## 3. What's on the site

- **Home:** a 3D studio for your books, your story as an officer and author, every series, your latest blog posts and the full shelf of books.
- **A page for every book** (`/books/...`) with its cover, description and buying link. These are the pages Google shows for your titles.
- **Blog** (`/blog/`): your latest post featured, older posts below, all linking to WordPress.
- **Phones:** the site is designed for phones as well as computers, with swipeable book cards and a bottom menu.

---

## 4. For KODSINC Studio: one-time setup and handover

These steps need the GitHub account that owns the repository (Rlyzionn).

**Connect the book editor (Pages CMS)**

1. Go to https://app.pagescms.org, sign in with GitHub, and install the Pages CMS GitHub App on the `Rlyzionn/Author-Website1` repository only.
2. Open the repository in Pages CMS. The **Books** editor comes from `.pages.yml` in this repository.
3. Open **Collaborators** (repository settings in Pages CMS) and invite Joe's email address.
4. Make a small test edit (for example, retype a full stop in a description), save, and confirm the Vercel deployment succeeds.

**Connect Joe's domain (when ready)**

1. In Vercel, open the project, then **Settings → Domains**, and add the domain. Vercel shows the DNS records to add at the domain registrar.
2. In **Settings → Environment Variables**, add `SITE_URL` set to the new address (for example `https://joebroadmeadow.com`) and redeploy. Every page address, the sitemap and the sharing previews then use the new domain.
3. Submit `https://<domain>/sitemap.xml` in Google Search Console.

**Share previews for new covers**

Each book has a 1200×630 preview image for Facebook, LinkedIn, X and messages (`assets/og/`). Books added later use their cover until a card is made. To make cards for new covers, from the repository root:

```
pip install pillow
python tools/share-cards.py
```

then commit the new files in `assets/og/`.

**Walkthrough agenda (30 minutes with Joe)**

1. Tour the site on his phone and computer (5 min).
2. Publish or update a WordPress post and watch it appear (5 min, allow for the 10-minute refresh).
3. In Pages CMS: change a buying link and save; watch the site update (5 min).
4. Add a test book with a cover, check its page, then delete it (10 min).
5. Questions, and where to find this guide (5 min).

**Still to collect from Joe**

- Covers for *Buried Verdicts*, *Improbable Cause*, *Defending the Last Dragon* and *Flap Flap* (they show a text placeholder until then).
- A high-resolution headshot. The only public one is 200×255 pixels and has been enlarged.
- Amazon links for *Raising the Last Dragon* and *Thauma* if they are on sale.
- Confirmation that he's happy for the covers from his blog and Amazon to be used (they are his own books).

---

## 5. What's done

| Included in the package | Status |
|---|---|
| Book spotlights: real covers, descriptions and buying links | Done, 16 books with their own pages |
| Your blog, connected | Done, new posts appear automatically |
| An author home | Done |
| Easy updates | Done: Pages CMS for books, WordPress for posts |
| Works on every screen | Done, phone-first design |
| Basic search setup | Done: page titles and descriptions, book data for Google, sitemap, sharing previews |
| Testing and walkthrough | Tested; walkthrough as above |
