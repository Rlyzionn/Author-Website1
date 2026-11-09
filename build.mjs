import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const output = 'public';
const site = 'https://author-website1-eight.vercel.app';
const books = JSON.parse(readFileSync('books.json', 'utf8'));
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

if (catalog.size !== books.length) throw new Error('Each book needs a unique ID.');

function coverMarkup(book, extraClass = '', decorative = true) {
  const title = escape(book.title);
  const alt = decorative ? '' : 'Cover of ' + title;
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
    status: book.status, buy: book.buy, 'cover-file': book.cover && coverPath(book),
  };
  const data = Object.entries(attributes)
    .filter(([, value]) => value)
    .map(([key, value]) => ' data-' + key + '="' + escape(value) + '"').join('');
  return `<li class="book"${data}>
    <a href="${bookPath(book)}">
      ${coverMarkup(book)}
      <span class="book__series">${escape(series[book.series])}</span>
      <span class="book__title">${escape(book.title)}</span>
      ${book.cover ? '' : '<span class="book__status">' + escape(book.status || 'Cover unavailable') + '</span>'}
    </a>
  </li>`;
}

function bookPage(book) {
  const title = escape(book.title);
  const description = escape(book.description);
  const canonical = site + bookPath(book);
  const image = site + (book.cover ? coverPath(book) : '/assets/headshot.jpg');
  const schema = {
    '@context': 'https://schema.org', '@type': 'Book', name: book.title,
    url: canonical, description: book.description,
    author: { '@type': 'Person', name: 'Joe Broadmeadow' },
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
  <title>${title} | Joe Broadmeadow</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
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
      ${book.cover ? '' : '<figcaption>Cover unavailable</figcaption>'}
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
        <a href="/#shelf">Books</a><a href="/#writing">Writing</a><a href="/#about">About</a>
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
    throw new Error('Invalid book ID or series: ' + book.id);
  }
  if (book.cover) readFileSync(book.cover);
  const folder = join(output, 'books', book.id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'index.html'), bookPage(book));
}

const josh = books.filter((book) => book.series === 'josh');
const postCards = posts.map(({ title, url, date }) => {
  const label = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date));
  return `<article class="writing__post">
    <time class="label" datetime="${escape(date)}">${escape(label)}</time>
    <h3><a href="${escape(url)}">${escape(title)}</a></h3>
  </article>`;
}).join('\n');

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
writeFileSync(join(output, 'index.html'), home);
writeFileSync(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
writeFileSync(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', ...books.map(bookPath)].map((path) => '  <url><loc>' + site + path + '</loc></url>').join('\n')}
</urlset>\n`);
