# Joe Broadmeadow website

The Vercel site is the front door for Joe’s books. Joe publishes in WordPress as usual, and the Writing section pulls his three latest public posts. Readers open the original WordPress article or browse the complete archive there.

## Publish a post

1. Sign in to [WordPress](https://joebroadmeadowblog.com/wp-admin/) and open **Posts**.
2. Write or edit a post and choose **Publish**. Set the post to **Public** if it should appear on the site.
3. Open [Latest writing](https://author-website1-eight.vercel.app/#writing) and refresh to check the title, excerpt and article link. WordPress caching can delay updates briefly. There is no GitHub step for blog posts.

## Update a book

1. Open [the book catalog in GitHub](https://github.com/Rlyzionn/Author-Website1/blob/main/books.json) while signed in with repository editing access. Select the pencil icon to edit it.
2. Find the book by its title and update the value in quotes. For a purchase link, use the book’s own product page in the `buy` field. For a new book, duplicate an entry in the same series and give it a unique lowercase `id`. That ID becomes part of the book’s web address.
3. To replace a cover, [upload the new WebP image](https://github.com/Rlyzionn/Author-Website1/upload/main/assets/covers) using a new filename. Set `cover` to its repository path, such as `assets/covers/title-v2.webp`. Set `coverSource` to the original source URL. Use a front-cover image with the entire artwork in frame, ideally around 1,000 pixels wide.
4. Commit the update. Check the Vercel deployment, then open [All books](https://author-website1-eight.vercel.app/#shelf) and the individual book page to confirm the changes.

The cover and purchase fields are optional. Leave either field out when an asset or an edition-specific purchase link is unavailable. A title with no cover displays as text. A title with no purchase link shows its author announcement or the official WordPress catalog.

## Preview and verify

Run `node build.mjs` from the repository root. Serve the generated `public` directory to preview the site. Vercel uses the same build command. The build creates the homepage, book pages, sitemap and robots file. The homepage markup is maintained in `index.html` and the visual styling lives in `styles.css`.

Before publishing an update, check the site at a desktop and phone width. Open a book from the shelf and from its direct URL, follow its purchase link, and verify that the archive still opens. Cover sources are recorded in `books.json`. The site shows saved WordPress article links if the live feed is temporarily unavailable.
