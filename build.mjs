import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const output = 'public';
// Set SITE_URL in Vercel when Joe's own domain is connected.
const site = (process.env.SITE_URL || 'https://author-website1-eight.vercel.app').replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

// books.json is edited through Pages CMS, so tidy what a form can produce:
// blank fields are dropped, cover paths lose any leading slash, and a missing
// or malformed ID is made from the title.
const slug = (text) => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const books = JSON.parse(readFileSync('books.json', 'utf8')).map((raw) => {
  const book = Object.fromEntries(Object.entries(raw)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    .filter(([, value]) => value !== '' && value !== null && value !== undefined));
  if (book.cover) book.cover = book.cover.replace(/^\/+/, '');
  if (!/^[a-z0-9-]+$/.test(book.id || '')) book.id = slug(book.id || book.title);
  return book;
});
const posts = JSON.parse(readFileSync('writing-snapshot.json', 'utf8'));
const catalog = new Map(books.map((book) => [book.id, book]));
const series = {
  josh: 'Josh Williams', hawk: 'Hawk Bennett', true: 'True crime',
  dragon: 'The Last Dragon', trail: 'The Appalachian Trail', kids: 'Picture book',
};
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const bookPath = (book) => '/books/' + book.id + '/';
const coverPath = (book) => '/' + book.cover;
// a meta description search engines show in full (about 155 characters)
const snippet = (text, max = 155) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '') + '…';
};
// 1200x630 JPEG share cards (made by tools/share-cards.py) beat WebP covers
// on social sites; new books without one fall back to their cover
const shareImage = (name, fallback) => site + (existsSync('assets/og/' + name + '.jpg') ? '/assets/og/' + name + '.jpg' : fallback);

if (catalog.size !== books.length) throw new Error('Two books share the same ID. Give each book its own ID in the Books editor.');

function coverMarkup(book, extraClass = '', decorative = true) {
  const title = escape(book.title);
  const alt = decorative ? '' : escape(book.artLabel || 'Cover of ' + book.title);
  const art = book.cover
    ? '<img src="' + escape(coverPath(book)) + '" alt="' + alt + '" width="512" height="768" ' + (decorative ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"') + '>'
    : '<span class="cover__title">' + title + '</span>';
  return '<span class="cover' + extraClass + '" data-cover="' + book.id + '" data-series="' + book.series + '"' +
    (decorative ? ' aria-hidden="true"' : '') + '>' + art + '</span>';
}

function shelfItem(book) {
  const attributes = {
    book: book.id, series: book.series, tagline: book.tagline,
    description: book.description, coauthor: book.coauthor, subtitle: book.subtitle,
    status: book.status, 'art-label': book.artLabel, buy: book.buy, 'cover-file': book.cover && coverPath(book),
  };
  const data = Object.entries(attributes)
    .filter(([, value]) => value)
    .map(([key, value]) => ' data-' + key + '="' + escape(value) + '"').join('');
  return `<li class="book"${data}>
    <a href="${bookPath(book)}">
      ${coverMarkup(book)}
      <span class="book__series">${escape(series[book.series])}</span>
      <span class="book__title">${escape(book.title)}</span>
      ${book.cover && !book.artLabel ? '' : '<span class="book__status">' + escape(book.artLabel || book.status || 'Cover unavailable') + '</span>'}
    </a>
  </li>`;
}

function bookPage(book) {
  const title = escape(book.title);
  const description = escape(book.description);
  const metaDescription = escape(snippet(book.description));
  const pageTitle = escape(book.title + ' by Joe Broadmeadow');
  const canonical = site + bookPath(book);
  const image = shareImage(book.id, book.cover ? coverPath(book) : '/assets/headshot.jpg');
  const schema = {
    '@context': 'https://schema.org', '@type': 'Book', name: book.title,
    url: canonical, description: book.description,
    author: { '@type': 'Person', name: 'Joe Broadmeadow', url: site + '/' },
    ...(book.buy && { sameAs: book.buy }),
    ...(book.isbn && { isbn: book.isbn }),
    ...(book.cover && { image }),
  };
  const actions = [
    book.buy && ['Buy on Amazon', book.buy],
    book.infoUrl && [book.infoLabel, book.infoUrl],
    book.goodreads && ['Find on Goodreads', book.goodreads],
    !book.buy && !book.infoUrl && ['View Joe’s official catalog', 'https://joebroadmeadowblog.com/books/'],
  ].filter(Boolean);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle}</title>
  <meta name="description" content="${metaDescription}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="book">
  <meta property="og:site_name" content="Joe Broadmeadow">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${metaDescription}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#070708">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300..600&display=swap">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
</head>
<body class="book-page">
  <header class="wrap wrap--wide book-page__header">
    <a class="brand" href="/" aria-label="Joe Broadmeadow, home">
      <span class="brand__mark" aria-hidden="true">JB</span>
      <span class="brand__name">Joe Broadmeadow</span>
    </a>
    <a class="btn btn-frame btn-sm" href="/#shelf">All books</a>
  </header>
  <main class="wrap book-page__grid">
    <figure class="book-page__art">
      ${coverMarkup(book, '', false)}
      ${book.cover && !book.artLabel ? '' : '<figcaption>' + escape(book.artLabel || 'Cover unavailable') + '</figcaption>'}
    </figure>
    <div>
      <p class="label">${escape(series[book.series])}</p>
      <h1 class="title">${title}</h1>
      ${book.subtitle ? '<p class="casefile__sub">' + escape(book.subtitle) + '</p>' : ''}
      <p class="book-page__byline">By Joe Broadmeadow${book.coauthor ? ' ' + escape(book.coauthor) : ''}</p>
      ${book.status ? '<p class="tag">' + escape(book.status) + '</p>' : ''}
      <p class="lede">${description}</p>
      ${book.isbn ? '<p class="book-page__isbn">Paperback ISBN ' + escape(book.isbn) + '</p>' : ''}
      <div class="cta-row">${actions.map(([label, url], i) =>
        '<a class="btn ' + (i === 0 ? 'btn-frame' : 'btn-link') + '" href="' + escape(url) + '">' + escape(label) + '</a>'
      ).join('')}</div>
    </div>
  </main>
  <footer class="footer">
    <div class="wrap wrap--wide footer__inner">
      <nav class="footer__links" aria-label="More from Joe">
        <a href="/#shelf">Books</a><a href="/blog/">Blog</a><a href="/#about">About</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;
}

mkdirSync(output, { recursive: true });
for (const file of ['assets', 'js', 'styles.css']) cpSync(file, join(output, file), { recursive: true });
for (const book of books) {
  if (!/^[a-z0-9-]+$/.test(book.id) || !Object.hasOwn(series, book.series)) {
    throw new Error(`"${book.title}" needs a series chosen in the Books editor.`);
  }
  if (book.cover && !existsSync(book.cover)) throw new Error(`The cover image for "${book.title}" was not found (${book.cover}). Upload it again in the Books editor.`);
  const folder = join(output, 'books', book.id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.html'), bookPage(book));
}

const josh = books.filter((book) => book.series === 'josh');
function postCard({ title, url, date }, heading = 'h3') {
  const label = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date));
  return `<article class="writing__post">
    <time class="label" datetime="${escape(date)}">${escape(label)}</time>
    <${heading}><a href="${escape(url)}">${escape(title)}</a></${heading}>
  </article>`;
}
const postCards = posts.map((post) => postCard(post)).join('\n');

const home = readFileSync('index.html', 'utf8')
  .replace('<!-- BOOK_CATALOG -->', books.map(shelfItem).join('\n'))
  .replace('<!-- WRITING_SNAPSHOT -->', postCards)
  .replace('<!-- JOSH_PIPS -->', josh.map((_, i) => i === 0 ? '<i class="is-on"></i>' : '<i></i>').join(''))
  .replace('<!-- JOSH_TICKS -->', josh.map((book, i) =>
    `<li><a href="${bookPath(book)}" data-josh="${i}">${escape(book.title)}</a></li>`
  ).join('\n'))
  .replace(/<span class="cover cover--thumb" data-cover="([^"]+)" data-series="[^"]+"><span class="cover__title">[^<]*<\/span><\/span>/g,
    (_, id) => coverMarkup(catalog.get(id), ' cover--thumb'))
  .replace(/\{\{buy:([\w-]+)\}\}/g, (_, id) => escape(catalog.get(id).buy || bookPath(catalog.get(id))));
writeFileSync(join(output, 'index.html'), home.replaceAll('https://author-website1-eight.vercel.app', site));
mkdirSync(join(output, 'blog'), { recursive: true });
const blog = readFileSync('blog.html', 'utf8')
  .replace('<!-- WRITING_SPOTLIGHT -->', postCard(posts[0], 'h2'))
  .replace('<!-- WRITING_SNAPSHOT -->', posts.slice(1).map((post) => postCard(post)).join('\n'));
writeFileSync(join(output, 'blog', 'index.html'), blog.replaceAll('https://author-website1-eight.vercel.app', site));
writeFileSync(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
writeFileSync(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', '/blog/', ...books.map(bookPath)].map((path) => '  <url><loc>' + site + path + '</loc><lastmod>' + today + '</lastmod></url>').join('\n')}
</urlset>\n`);

// a 404 page in the site's own style, served by Vercel for unknown addresses
writeFileSync(join(output, '404.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | Joe Broadmeadow</title>
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#070708">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300..600&display=swap">
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="book-page">
  <header class="wrap wrap--wide book-page__header">
    <a class="brand" href="/" aria-label="Joe Broadmeadow, home">
      <span class="brand__mark" aria-hidden="true">JB</span>
      <span class="brand__name">Joe Broadmeadow</span>
    </a>
  </header>
  <main class="wrap not-found">
    <p class="label">Case closed</p>
    <h1 class="title title--xl">This page <em>isn’t here.</em></h1>
    <p class="lede">The address may have changed. Every book and every post is still a click away.</p>
    <div class="cta-row">
      <a class="btn btn-frame" href="/#shelf">See all books</a>
      <a class="btn btn-link" href="/blog/">Read the blog</a>
      <a class="btn btn-link" href="/">Home</a>
    </div>
  </main>
</body>
</html>
`);
