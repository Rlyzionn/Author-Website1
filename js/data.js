// The bibliography lives in the HTML (#shelfGrid) so the page works without
// JavaScript. This module reads it back for the covers and the 3D stage.
//
// To use a real cover, drop the image in assets/covers/<id>.jpg and add its
// path to COVER_FILES. Otherwise a cover is drawn in code in the series' style.

export const COVER_FILES = {
  // pieces: 'assets/covers/pieces.jpg',
};

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
  motif: el.dataset.motif,
  title: el.querySelector('.book__title').textContent.trim(),
  subtitle: el.dataset.subtitle || null,
  coauthor: el.dataset.coauthor || null,
  soon: el.hasAttribute('data-soon'),
  tagline: el.dataset.tagline,
  amazon: el.querySelector('a').href,
  goodreads: el.dataset.goodreads,
  cover: COVER_FILES[el.dataset.book] || null,
}));

export const byId = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
export const bySeries = (s) => BOOKS.filter((b) => b.series === s);

// When the page stacks text under the 3D instead of beside it: phones, and any
// portrait screen up to a small laptop (tablets). Must match the stacked
// @media rule in styles.css.
export const STACKED = '(max-width: 599px), (max-width: 1199px) and (max-aspect-ratio: 11/10)';
