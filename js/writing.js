const source = 'https://joebroadmeadowblog.com';
const feed = source + '/wp-json/wp/v2/posts?per_page=3&_fields=date,link,title,excerpt';
const grid = document.querySelector('#writingPosts');
const status = document.querySelector('#writingStatus');
const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

function plainText(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  template.content.querySelectorAll('script, style').forEach((node) => node.remove());
  return template.content.textContent.replace(/\s+/g, ' ').trim();
}

function makePost(post) {
  if (!post?.link || !post.title?.rendered || !post.date) return null;
  const url = new URL(post.link, source);
  if (url.origin !== source) return null;
  const date = post.date.slice(0, 10);
  const published = new Date(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(published.valueOf())) return null;
  const title = plainText(post.title.rendered);
  if (!title) return null;

  const article = document.createElement('article');
  article.className = 'writing__post';
  const time = document.createElement('time');
  time.className = 'label';
  time.dateTime = date;
  time.textContent = formatDate.format(published);
  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = url.href;
  link.textContent = title;
  heading.append(link);
  article.append(time, heading);

  if (post.excerpt?.rendered && !post.excerpt.protected) {
    const excerpt = document.createElement('p');
    excerpt.className = 'writing__excerpt';
    excerpt.textContent = plainText(post.excerpt.rendered).replace(/\s*\[…\]$/, '…');
    article.append(excerpt);
  }
  return article;
}

async function refreshWriting() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(feed, { signal: controller.signal });
    if (!response.ok) throw new Error('WordPress feed unavailable');
    const posts = await response.json();
    const cards = posts.map(makePost).filter(Boolean);
    if (cards.length) grid.replaceChildren(...cards);
  } catch {
    status.textContent = 'Showing saved posts. Use the WordPress archive for the latest writing.';
  } finally {
    clearTimeout(timeout);
  }
}

refreshWriting();
