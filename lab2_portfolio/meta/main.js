import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// =====================================================================
// Lab 6 — Step 1: load and process the data
// =====================================================================
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: 'https://github.com/shaunisrani/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      // keep the raw lines, but hidden from console output / Object.keys
      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: false,
        writable: false,
        enumerable: false,
      });
      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime); // Lab 8: chronological order for the story
}

// =====================================================================
// Lab 6 — Step 1.3: summary stats
// =====================================================================
function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');
  container.selectAll('*').remove();
  const dl = container.append('dl').attr('class', 'stats');

  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  const workByDay = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { weekday: 'long' }),
  );

  const stats = [
    ['Total <abbr title="Lines of code">LOC</abbr>', data.length],
    ['Commits', commits.length],
    ['Files', d3.group(data, (d) => d.file).size],
    ['Avg file length', Math.round(d3.mean(fileLengths, (d) => d[1]) ?? 0)],
    ['Max depth', d3.max(data, (d) => d.depth) ?? 0],
    ['Most work in the', d3.greatest(workByPeriod, (d) => d[1])?.[0] ?? '–'],
    ['Busiest day', d3.greatest(workByDay, (d) => d[1])?.[0] ?? '–'],
  ];
  for (const [label, value] of stats) {
    dl.append('dt').html(label);
    dl.append('dd').text(value);
  }
}

// =====================================================================
// Lab 6 — Steps 2–5: scatterplot, tooltip, dot size, brushing
// =====================================================================
const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 40 };
const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

// scales are global so brushing (and Lab 8 updates) can use them
let xScale;
let yScale;

function renderScatterPlot(data, commits) {
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  // gridlines first, so they sit under the dots
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  svg.append('g').attr('class', 'dots');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(d3.axisBottom(xScale));
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, '0') + ':00'));

  drawDots(commits);
  createBrushSelector(svg);
}

// Lab 8 Step 1.2: update the existing chart instead of drawing a new one
function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');
  if (commits.length) {
    xScale = xScale.domain(d3.extent(commits, (d) => d.datetime)).nice();
  }
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(d3.axisBottom(xScale));
  drawDots(commits);
}

function drawDots(commits) {
  const [minLines, maxLines] = d3.extent(allCommits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 30]);
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  d3.select('#chart g.dots')
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id) // Lab 8 Step 1.3: stable keys
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => timeOfDayColor(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// bluer at night, orange during the day
function timeOfDayColor(hour) {
  const daylight = (1 - Math.cos((hour / 24) * 2 * Math.PI)) / 2; // 0 at midnight, 1 at noon
  return d3.interpolateRgb('#3b5bdb', '#f08c00')(daylight);
}

// ----- tooltip (Step 3) -----
function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;
  const link = document.getElementById('commit-link');
  link.href = commit.url;
  link.textContent = commit.id.slice(0, 7);
  document.getElementById('commit-date').textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  document.getElementById('commit-time-of-day').textContent = commit.datetime?.toLocaleString(
    'en',
    { timeStyle: 'short' },
  );
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

// ----- brushing (Step 5) -----
function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
  // put the dots (and anything after the overlay) above the brush overlay so hover still works
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('#chart circle').classed('selected', (d) => isCommitSelected(selection, d));
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection ? filteredCommits.filter((d) => isCommitSelected(selection, d)) : [];
  document.querySelector('#selection-count').textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;
  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection ? filteredCommits.filter((d) => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');
  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const lines = selectedCommits.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );
  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const formatted = d3.format('.1~%')(count / lines.length);
    container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${formatted})</dd>`;
  }
}

// =====================================================================
// Lab 8 — Step 2: unit visualization of files
// =====================================================================
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(commitsShown) {
  const lines = commitsShown.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt');
        div.append('dd');
      }),
    );

  filesContainer
    .select('dt')
    .html((d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

// =====================================================================
// Main
// =====================================================================
const data = await loadData();
const allCommits = processCommits(data);
let filteredCommits = allCommits;

renderCommitInfo(data, allCommits);
renderScatterPlot(data, allCommits);
updateFileDisplay(allCommits);

// Lab 8 Step 1.1: slider → commitMaxTime
let commitProgress = 100;
const timeScale = d3
  .scaleTime()
  .domain([d3.min(allCommits, (d) => d.datetime), d3.max(allCommits, (d) => d.datetime)])
  .range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);

const slider = document.getElementById('commit-progress');
const timeEl = document.getElementById('commit-time');

function showUntil(maxTime) {
  commitMaxTime = maxTime;
  timeEl.textContent = commitMaxTime.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' });
  filteredCommits = allCommits.filter((d) => d.datetime <= commitMaxTime);
  const filteredLines = data.filter((d) => d.datetime <= commitMaxTime);
  renderCommitInfo(filteredLines, filteredCommits);
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function onTimeSliderChange() {
  commitProgress = Number(slider.value);
  showUntil(timeScale.invert(commitProgress));
}
slider.addEventListener('input', onTimeSliderChange);
onTimeSliderChange();

// Lab 8 Step 3.2: one story step per commit
d3.select('#scatter-story')
  .selectAll('.step')
  .data(allCommits)
  .join('div')
  .attr('class', 'step')
  .html((d, i) => {
    const fileCount = d3.rollups(
      d.lines,
      (D) => D.length,
      (l) => l.file,
    ).length;
    return `
      On ${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })},
      I made <a href="${d.url}" target="_blank">${
        i > 0 ? 'another commit' : 'my first commit'
      }</a>.
      It still accounts for ${d.totalLines} lines across ${fileCount} ${fileCount === 1 ? 'file' : 'files'}
      in the site today.
    `;
  });

// Lab 8 Step 3.3: scrolling drives the same update as the slider
function onStepEnter(response) {
  const commit = response.element.__data__;
  slider.value = Math.round(timeScale(commit.datetime));
  commitProgress = Number(slider.value);
  showUntil(commit.datetime);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);
