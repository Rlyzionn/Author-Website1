# Joe Broadmeadow website

The Vercel site is the front door for Joe’s books. Joe publishes in WordPress as usual, and the homepage shows his three latest public posts. The dedicated [Blog page](https://author-website1-eight.vercel.app/blog/) spotlights the newest post and lets readers load older posts. Readers open the original WordPress article or browse the complete archive there.

## Publish a post

1. Sign in to [WordPress](https://joebroadmeadowblog.com/wp-admin/) and open **Posts**.
2. Write or edit a post and choose **Publish**. Set the post to **Public** if it should appear on the site.
3. Open the [Blog page](https://author-website1-eight.vercel.app/blog/) and refresh to check the title, excerpt and article link. WordPress caching can delay updates briefly. There is no GitHub step for blog posts.

## Update a book

Books are edited in **Pages CMS**, a form-based editor: no code and no GitHub account needed. Sign in at [app.pagescms.org](https://app.pagescms.org), open **Author-Website1**, then **Books**. Each field explains itself; covers upload straight from the form. Saving publishes the change in about a minute. Step-by-step instructions, and the one-time setup for inviting Joe, are in [HANDOVER.md](HANDOVER.md).

The editor writes to `books.json`, which can still be edited directly on GitHub. The cover and purchase fields are optional: a title with no cover displays as text, and one with no purchase link shows its announcement or the official WordPress catalog. If a change is invalid (a duplicate web address name, no series, a missing cover file), the build stops with a plain-English message and the previous version stays live.

## Preview and verify

Run `node build.mjs` from the repository root. Serve the generated `public` directory to preview the site. Vercel uses the same build command. The build creates the homepage, book pages, blog page, 404 page, sitemap and robots file. Set the `SITE_URL` environment variable when the site moves to its own domain. Share preview images live in `assets/og/` and are made with `python tools/share-cards.py`. The homepage markup is maintained in `index.html` and the visual styling lives in `styles.css`.

Before publishing an update, check the site at a desktop and phone width. Open a book from the shelf and from its direct URL, follow its purchase link, and verify that the archive still opens. Cover sources are recorded in `books.json`. The site shows saved WordPress article links if the live feed is temporarily unavailable.
