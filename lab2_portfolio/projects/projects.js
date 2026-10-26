import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

// Lab 4 Step 1.6: show the project count in the page title
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle) {
  projectsTitle.textContent = `${projects?.length ?? 0} Projects`;
}

// ---------- Lab 5 ----------
// Shared filter state. Keeping BOTH filters here (instead of each event handler
// only knowing about its own filter) is what lets search + pie selection combine.
let query = '';
let selectedYear = null; // track the selected wedge by its year label, not its index

const colors = d3.scaleOrdinal(d3.schemeTableau10);
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

// Step 4.3: case-insensitive search across all project metadata
function filterByQuery(list) {
  const q = query.toLowerCase();
  return list.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(q);
  });
}

// Step 5.3 (+ extra-credit fix): apply BOTH the search query and the selected year
function filterByQueryAndYear(list) {
  const searched = filterByQuery(list);
  return selectedYear === null ? searched : searched.filter((p) => p.year === selectedYear);
}

// Step 4.4: all plotting lives in one function so it can re-render on every change
function renderPieChart(projectsGiven) {
  // Step 3.1: projects per year
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  // sort years so wedge order and colors are stable
  rolledData.sort((a, b) => d3.ascending(a[0], b[0]));
  const data = rolledData.map(([year, count]) => ({ value: count, label: year }));

  // if the selected year disappears after searching, drop the selection
  if (selectedYear !== null && !data.some((d) => d.label === selectedYear)) {
    selectedYear = null;
  }

  // Steps 1.4–1.5: slices -> arcs
  const sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcData = sliceGenerator(data);
  const arcs = arcData.map((d) => arcGenerator(d));

  // clear old paths and legend items before re-drawing
  const svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove();
  const legend = d3.select('.legend');
  legend.selectAll('li').remove();

  arcs.forEach((arc, i) => {
    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(data[i].label))
      .attr('class', data[i].label === selectedYear ? 'selected' : null)
      .on('click', () => selectYear(data[i].label));
  });

  // Step 2.2: legend built with D3
  data.forEach((d) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(d.label)}`)
      .attr('class', d.label === selectedYear ? 'legend-item selected' : 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => selectYear(d.label));
  });
}

// Step 5.2: clicking a wedge selects it; clicking it again deselects it
function selectYear(year) {
  selectedYear = selectedYear === year ? null : year;
  update();
}

// One update path for every interaction: the pie shows the searched projects,
// the list shows projects matching the search AND the selected year.
function update() {
  renderPieChart(filterByQuery(projects));
  renderProjects(filterByQueryAndYear(projects), projectsContainer, 'h2');
}

// Step 4.2: search bar ('input' updates live while typing)
const searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  update();
});

// initial render on page load
update();
