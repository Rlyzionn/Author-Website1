// The build renders the catalog into HTML so book pages work without JavaScript.
export const SERIES = {
  josh:   { label: 'A Josh Williams Novel', name: 'Josh Williams' },
  hawk:   { label: 'A Hawk Bennett Novel',  name: 'Hawk Bennett' },
  true:   { label: 'True Crime',            name: 'True Crime' },
  dragon: { label: 'The Last Dragon',       name: 'The Last Dragon' },
  trail:  { label: 'The Appalachian Trail', name: 'The Trail' },
  kids:   { label: 'A Picture Book',        name: 'Picture Books' },
};

export const BOOKS = [...document.querySelectorAll('#shelfGrid [data-book]')].map((el) => ({
  id: el.dataset.book,
  series: el.dataset.series,
  title: el.querySelector('.book__title').textContent.trim(),
  subtitle: el.dataset.subtitle || null,
  coauthor: el.dataset.coauthor || null,
  status: el.dataset.status,
  tagline: el.dataset.tagline,
  description: el.dataset.description,
  buy: el.dataset.buy,
  page: el.querySelector('a').href,
  cover: el.dataset.coverFile,
  artLabel: el.dataset.artLabel,
}));

export const byId = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
export const bySeries = (s) => BOOKS.filter((b) => b.series === s);

// When the page stacks text under the 3D instead of beside it: phones, and any
// portrait screen up to a small laptop (tablets). Must match the stacked
// @media rule in styles.css.
export const STACKED = '(max-width: 599px), (max-width: 1199px) and (max-aspect-ratio: 11/10)';
