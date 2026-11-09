// GET /api/posts?page=1&per_page=9&category=<id>
// Joe's latest WordPress posts as slim JSON, cached at the edge for ten
// minutes, so a new post reaches the site shortly after it is published.
// The page falls back to the WordPress REST API directly if this is absent.

const WP = 'https://joebroadmeadowblog.com/wp-json/wp/v2/posts';
const int = (v, fallback, min, max) => Math.min(max, Math.max(min, parseInt(v, 10) || fallback));

function slim(p) {
  const e = p._embedded || {};
  const media = (e['wp:featuredmedia'] || [])[0] || {};
  const sizes = (media.media_details && media.media_details.sizes) || {};
  const image = (sizes.medium_large || sizes.large || sizes.full || {}).source_url || media.source_url || null;
  const category = (((e['wp:term'] || [])[0] || [])[0] || {}).name || null;
  return { id: p.id, date: p.date, link: p.link, title: p.title.rendered, excerpt: p.excerpt.rendered, image, category };
}

module.exports = async (req, res) => {
  const q = new URLSearchParams({
    page: String(int(req.query.page, 1, 1, 1000)),
    per_page: String(int(req.query.per_page, 9, 1, 24)),
    _embed: 'wp:featuredmedia,wp:term',
    _fields: 'id,date,link,title,excerpt,_links,_embedded',
  });
  const category = int(req.query.category, 0, 0, 1e10);
  if (category) q.set('categories', String(category));
  try {
    const r = await fetch(`${WP}?${q}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      // WordPress answers 400 for a page past the end
      res.status(r.status === 400 ? 200 : 502).json({ posts: [], total: 0, pages: 0 });
      return;
    }
    const posts = (await r.json()).map(slim);
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
    res.status(200).json({ posts, total: +r.headers.get('x-wp-total') || 0, pages: +r.headers.get('x-wp-totalpages') || 0 });
  } catch {
    res.status(502).json({ posts: [], total: 0, pages: 0 });
  }
};
