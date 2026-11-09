const source = 'https://joebroadmeadowblog.com';
const grid = document.querySelector('#writingPosts');
const status = document.querySelector('#writingStatus');
const spotlight = document.querySelector('#writingSpotlight');
const more = document.querySelector('#writingMore');
const pageSize = spotlight ? 9 : 3;
const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });
const shown = new Set();
let page = 0;

function plainText(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  template.content.querySelectorAll('script, style').forEach((node) => node.remove());
  return template.content.textContent.replace(/\s+/g, ' ').trim();
}

function parseUrl(value) {
  try { return new URL(value, source); } catch { return null; }
}

function featuredImage(post) {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const url = parseUrl(media?.media_details?.sizes?.medium_large?.source_url || media?.source_url);
  if (!url || url.protocol !== 'https:') return null;
  const authorMedia = url.origin === source && url.pathname.startsWith('/wp-content/uploads/');
  const wordpressCdn = /^i[0-3]\.wp\.com$/.test(url.hostname) &&
    url.pathname.startsWith('/joebroadmeadowblog.com/wp-content/uploads/');
  if (!authorMedia && !wordpressCdn) return null;
  const image = document.createElement('img');
  image.src = url.href;
  image.alt = media.alt_text || '';
  image.decoding = 'async';
  return image;
}

function makePost(post, featured = false) {
  if (!post?.link || !post.title?.rendered || !post.date) return null;
  const url = parseUrl(post.link);
  if (!url || url.origin !== source || shown.has(url.href)) return null;
  const date = post.date.slice(0, 10);
  const published = new Date(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(published.valueOf())) return null;
  const title = plainText(post.title.rendered);
  if (!title) return null;

  const article = document.createElement('article');
  article.className = 'writing__post';
  const body = document.createElement('div');
  const time = document.createElement('time');
  time.className = 'label';
  time.dateTime = date;
  time.textContent = formatDate.format(published);
  const heading = document.createElement(featured ? 'h2' : 'h3');
  const link = document.createElement('a');
  link.href = url.href;
  link.textContent = title;
  heading.append(link);
  body.append(time, heading);

  if (post.excerpt?.rendered && !post.excerpt.protected) {
    const excerpt = document.createElement('p');
    excerpt.className = 'writing__excerpt';
    excerpt.textContent = plainText(post.excerpt.rendered).replace(/\s*\[…\]$/, '…');
    body.append(excerpt);
  }

  const image = featured ? featuredImage(post) : null;
  if (image) {
    article.classList.add('writing__post--illustrated');
    article.append(image);
    image.addEventListener('error', () => {
      image.remove();
      article.classList.remove('writing__post--illustrated');
    }, { once: true });
  }
  article.append(body);
  shown.add(url.href);
  return article;
}

async function loadPosts() {
  if (more) more.disabled = true;
  const next = page + 1;
  const withMedia = spotlight && next === 1;
  const fields = 'date,link,title,excerpt' + (withMedia ? ',_links,_embedded' : '');
  const pagination = spotlight ? '&page=' + next : '';
  const embed = withMedia ? '&_embed=wp%3Afeaturedmedia' : '';
  const feed = source + '/wp-json/wp/v2/posts?per_page=' + pageSize + pagination + embed + '&_fields=' + (spotlight ? encodeURIComponent(fields) : fields);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(feed, { signal: controller.signal });
    if (!response.ok) throw new Error('WordPress feed unavailable');
    const posts = await response.json();
    const cards = [];
    for (const post of posts) {
      const card = makePost(post, withMedia && cards.length === 0);
      if (card) cards.push(card);
    }
    if (!page && cards.length) {
      if (spotlight) spotlight.replaceChildren(cards.shift());
      grid.replaceChildren(...cards);
    } else {
      grid.append(...cards);
    }
    page = next;
    const total = Number(response.headers.get('X-WP-TotalPages'));
    if (more) more.hidden = posts.length < pageSize || (total > 0 && page >= total);
    if (page > 1) {
      status.textContent = cards.length ? `${cards.length} older posts loaded.` : 'No additional posts on this page.';
      cards[0]?.querySelector('a')?.focus();
    }
  } catch {
    status.textContent = page ? 'Older posts could not load. Try again or open the WordPress archive.' :
      'Showing saved posts. Open the WordPress archive for the latest writing.';
  } finally {
    clearTimeout(timeout);
    if (more) more.disabled = false;
  }
}

more?.addEventListener('click', loadPosts);
loadPosts();
