console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// ---------- Step 3: automatic navigation menu ----------
let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'meta/', title: 'Meta' },
  { url: 'https://github.com/shaunisrani', title: 'GitHub' },
];

const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/' // local server
    : '/portfolio/lab2_portfolio/'; // GitHub Pages (repo + subfolder)

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  url = !url.startsWith('http') ? BASE_PATH + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;
  nav.append(a);

  // highlight current page
  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  // open external links in a new tab
  if (a.host !== location.host) {
    a.target = '_blank';
  }
}

// ---------- Step 4: dark mode switch ----------
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

// ---------- Lab 4, Step 1.2: load JSON data ----------
export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

// ---------- Lab 4, Step 1.4: render projects ----------
const VALID_HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  // Guard against a missing container
  if (!(containerElement instanceof HTMLElement)) {
    console.error('renderProjects: containerElement is not a valid DOM element');
    return;
  }
  // Fall back to h2 if an invalid heading level is passed
  if (!VALID_HEADINGS.includes(headingLevel)) {
    console.warn(`renderProjects: invalid heading "${headingLevel}", using h2`);
    headingLevel = 'h2';
  }

  // Clear existing content so projects are not duplicated
  containerElement.innerHTML = '';

  // Placeholder when there is nothing to show
  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.innerHTML = '<p>No projects to display yet.</p>';
    return;
  }

  for (let project of projects) {
    const article = document.createElement('article');
    const title = project.title ?? 'Untitled project';
    article.innerHTML = `
      <${headingLevel}>${title}</${headingLevel}>
      <img src="${project.image ?? 'https://vis-society.github.io/labs/2/images/empty.svg'}" alt="${title}">
      <div class="project-text">
        <p>${project.description ?? ''}</p>
        <p class="project-year">c. ${project.year ?? ''}</p>
      </div>
    `;
    containerElement.appendChild(article);
  }
}

// ---------- Lab 4, Step 3: GitHub API ----------
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}

// ---------- Step 5 (optional): better contact form ----------
let form = document.querySelector('form');

form?.addEventListener('submit', function (event) {
  event.preventDefault();
  let data = new FormData(form);
  let params = [];
  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }
  let url = form.action + '?' + params.join('&');
  location.href = url;
});
