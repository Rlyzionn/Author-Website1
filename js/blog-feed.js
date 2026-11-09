// Joe's WordPress posts for the hero strip and blog.html. On Vercel this goes
// through /api/posts (slim, edge-cached); anywhere else it reads the WordPress
// REST API directly, which allows cross-origin requests.

const WP = 'https://joebroadmeadowblog.com/wp-json/wp/v2/posts';
const BLOG_HOST = 'https://joebroadmeadowblog.com/';

// The blog's own categories, largest first ("Uncategorized" left out)
export const CATEGORIES = [
  { id: 626298, name: 'Mind Wanderings' },
  { id: 196134, name: 'Serious Thoughts' },
  { id: 349, name: 'Writing' },
  { id: 783783208, name: 'JEBWizard Publishing' },
  { id: 17358, name: 'New Releases' },
];

// same shape as api/posts.js
function slim(p) {
  const e = p._embedded || {};
  const media = (e['wp:featuredmedia'] || [])[0] || {};
  const sizes = (media.media_details && media.media_details.sizes) || {};
  const image = (sizes.medium_large || sizes.large || sizes.full || {}).source_url || media.source_url || null;
  const category = (((e['wp:term'] || [])[0] || [])[0] || {}).name || null;
  return { id: p.id, date: p.date, link: p.link, title: p.title.rendered, excerpt: p.excerpt.rendered, image, category };
}

// WordPress sends HTML; the page only ever shows it as text
const toText = (html) => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
const httpsOnly = (url, prefix = 'https://') => (typeof url === 'string' && url.startsWith(prefix) ? url : null);

function clean(post) {
  return {
    ...post,
    title: toText(post.title),
    excerpt: toText(post.excerpt).replace(/\s*(\[(…|&hellip;|\.\.\.)\]|Continue reading.*)$/i, '').trim(),
    link: httpsOnly(post.link, BLOG_HOST) || BLOG_HOST,
    image: httpsOnly(post.image),
    date: new Date(post.date),
  };
}

export async function fetchPosts({ page = 1, perPage = 9, category = 0 } = {}) {
  const params = new URLSearchParams({ page, per_page: perPage });
  if (category) params.set('category', category);
  // the endpoint only exists on Vercel; local previews go straight to WordPress
  const onVercel = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && location.protocol !== 'file:';
  try {
    if (!onVercel) throw new Error('local');
    const r = await fetch(`/api/posts?${params}`);
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const d = await r.json();
      return { ...d, posts: d.posts.map(clean) };
    }
  } catch { /* fall through to WordPress */ }

  const q = new URLSearchParams({ page, per_page: perPage, _embed: 'wp:featuredmedia,wp:term', _fields: 'id,date,link,title,excerpt,_links,_embedded' });
  if (category) q.set('categories', category);
  // WordPress is slow uncached and occasionally drops a request: try twice
  let r;
  try { r = await fetch(`${WP}?${q}`); } catch {
    await new Promise((res) => setTimeout(res, 900));
    r = await fetch(`${WP}?${q}`);
  }
  if (!r.ok) return { posts: [], total: 0, pages: 0 };
  const posts = (await r.json()).map(slim).map(clean);
  return { posts, total: +r.headers.get('x-wp-total') || 0, pages: +r.headers.get('x-wp-totalpages') || 0 };
}

export const formatDate = (d, withYear = true) => d.toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
export const isFresh = (d) => Date.now() - d.getTime() < 3 * 864e5;
