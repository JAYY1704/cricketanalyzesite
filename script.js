function toggleTheme() {
    const themeSelect = document.getElementById('themeSelect');
    if (!themeSelect) return; // Skip if not on a page with theme toggle
    const theme = themeSelect.value;
    document.body.className = theme;
    localStorage.setItem('theme', theme);
}

window.onload = function() {
    const savedTheme = localStorage.getItem('theme') || 'classic-mode';
    document.body.className = savedTheme;
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;

    // Load data only for analyzer pages
    if (document.getElementById('chase-analyzer')) {
        console.log("Chase Analyzer page detected. Loading data...");
        populateOverSelect();
        loadChaseData();
    }
    if (document.getElementById('match-analyzer')) {
        console.log("Match Analyzer page detected. Loading data...");
        loadMatchData();
    }

    // Handle contact form submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Form submission requires a backend. Contact support@cricketanalyzer.com for now.');
        });
    }

    // Initialize hamburger menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
};

let chaseMatches = [];
let chaseFilteredMatches = [];
let chaseFirstInningsDone = false;
let chaseScoreRange = null;
let chaseTargetRuns = null;
let chaseLastData = null;
let chaseAllYears = [];
let chaseAllScoreRanges = [];
let chaseSelectedYears = [];

const overSelect = document.getElementById('overSelect');

function populateOverSelect() {
    if (!overSelect) return;
    overSelect.innerHTML = '<option value="">-- Select Over --</option>';
    for (let i = 1; i <= 40; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.text = `${i}th Over`;
        overSelect.appendChild(option);
    }
}

function loadChaseData() {
    const url = 'https://raw.githubusercontent.com/jayy1704/cricanalyze/main/2020-2024 excel.csv';
    console.log(`Fetching Chase data from: ${url}`);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} (${response.statusText})`);
            }
            console.log("Fetch successful. Response status:", response.status);
            return response.text();
        })
        .then(data => {
            console.log("Data received. First 100 characters:", data.substring(0, 100));
            if (!window.Papa) {
                throw new Error("PapaParse library is not loaded.");
            }
            Papa.parse(data, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        console.error("PapaParse errors:", results.errors);
                        document.getElementById('output').textContent = "Error parsing CSV: " + results.errors[0].message;
                        return;
                    }
                    chaseMatches = results.data;
                    chaseFilteredMatches = chaseMatches;
                    console.log(`Chase data loaded. Number of matches: ${chaseMatches.length}`);
                    document.getElementById('output').textContent = `Data loaded successfully! ${chaseMatches.length} matches found.`;
                },
                error: function(error) {
                    console.error("PapaParse error:", error);
                    document.getElementById('output').textContent = "Error parsing CSV: " + error.message;
                }
            });
        })
        .catch(err => {
            console.error("Fetch error:", err);
            document.getElementById('output').textContent = "Error loading data: " + err.message;
        });
}

function loadMatchData() {
    const url = 'https://raw.githubusercontent.com/jayy1704/cricanalyze/main/2020-2024 excel.csv';
    console.log(`Fetching Match data from: ${url}`);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} (${response.statusText})`);
            }
            console.log("Fetch successful. Response status:", response.status);
            return response.text();
        })
        .then(data => {
            console.log("Data received. First 100 characters:", data.substring(0, 100));
            if (!window.Papa) {
                throw new Error("PapaParse library is not loaded.");
            }
            Papa.parse(data, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        console.error("PapaParse errors:", results.errors);
                        document.getElementById('match-output').textContent = "Error parsing CSV: " + results.errors[0].message;
                        return;
                    }
                    matchMatches = results.data;
                    matchAllYears = [...new Set(matchMatches.map(match => match['year']))].sort((a, b) => a - b);
                    matchSelectedYears = matchAllYears.map(String);
                    console.log(`Match data loaded. Number of matches: ${matchMatches.length}`);
                    document.getElementById('match-output').textContent = `Data loaded successfully! ${matchMatches.length} matches found.`;
                },
                error: function(error) {
                    console.error("PapaParse error:", error);
                    document.getElementById('match-output').textContent = "Error parsing CSV: " + error.message;
                }
            });
        })
        .catch(err => {
            console.error("Fetch error:", err);
            document.getElementById('match-output').textContent = "Error loading data: " + err.message;
        });
}

function parseChaseScore(scoreWickets) {
    const parts = scoreWickets.split('/');
    if (parts.length !== 2) return [null, null];
    const runs = parseInt(parts[0]);
    const wickets = parseInt(parts[1]);
    if (isNaN(runs) || isNaN(wickets) || wickets < 0 || wickets > 10) return [null, null];
    return [runs, wickets];
}

function parseChaseRange(rangeStr) {
    if (!rangeStr) return null;
    if (rangeStr === "200+") return [200, Infinity];
    const [min, max] = rangeStr.split('-').map(Number);
    return [min, max];
}

function calculateChaseDifference(scoreLater, scoreEarlier) {
    if (!scoreLater || !scoreEarlier) return "N/A";
    const [runsLater, wicketsLater] = scoreLater.split('/').map(Number);
    const [runsEarlier, wicketsEarlier] = scoreEarlier.split('/').map(Number);
    return `${runsLater - runsEarlier}/${wicketsLater - wicketsEarlier}`;
}

function calculateChaseProbabilities(data) {
    const validResults = data.filter(row => row.Result.toLowerCase() === 'chased' || row.Result.toLowerCase() === 'defend');
    const totalValid = validResults.length;
    if (totalValid === 0) return { chased: 0, defend: 0 };
    const chasedCount = validResults.filter(row => row.Result.toLowerCase() === 'chased').length;
    return {
        chased: (chasedCount / totalValid * 100).toFixed(2),
        defend: ((totalValid - chasedCount) / totalValid * 100).toFixed(2)
    };
}

function isMatchInMatchAnalyzer(chaseMatch) {
    if (!matchLastData || matchLastData.length === 0) return false;
    return matchLastData.some(matchRow => {
        const chaseDetails = chaseMatch.originalMatch;
        const matchDetails = matchRow.match;
        const overs = ['6over', '10over', '15over', '20over'];
        return overs.every(over => {
            const chaseScore = chaseDetails[over] || 'N/A';
            const matchScore = matchDetails[over] || 'N/A';
            if (chaseScore === 'N/A' || matchScore === 'N/A') return false;
            const [chaseRuns, chaseWickets] = chaseScore.split('/').map(Number);
            const [matchRuns, matchWickets] = matchScore.split('/').map(Number);
            return chaseRuns === matchRuns && chaseWickets === matchWickets;
        });
    });
}

function processChaseInput() {
    const scoreWickets = document.getElementById('scoreInput').value.trim();
    const over = parseInt(document.getElementById('overSelect').value);
    const rangeStr = document.getElementById('rangeSelect').value;
    const [runs, wickets] = parseChaseScore(scoreWickets);
    const output = document.getElementById('output');

    if (!scoreWickets || isNaN(over) || runs === null || wickets === null) {
        output.textContent = "Please enter valid score/wickets (e.g., '20/1') and select an over.";
        return;
    }
    if (chaseMatches.length === 0) {
        output.textContent = "Please wait for the data to load.";
        return;
    }

    let compareData = chaseMatches;
    const selectedRange = parseChaseRange(rangeStr);
    const overKey = `${over}over`;

    if (over <= 20) {
        if (over === 20) {
            chaseFirstInningsDone = true;
            chaseTargetRuns = runs;
            chaseScoreRange = selectedRange || getChaseScoreRange(runs);
        }
    } else {
        if (!chaseFirstInningsDone) {
            const targetInput = prompt("Please enter the final score after 20 overs (e.g., '142/3'):");
            if (!targetInput) {
                output.textContent = "Target score required for 2nd innings analysis.";
                return;
            }
            const [targetRunsInput] = parseChaseScore(targetInput);
            if (targetRunsInput === null) {
                output.textContent = "Invalid target score format.";
                return;
            }
            chaseFirstInningsDone = true;
            chaseTargetRuns = targetRunsInput;
            chaseScoreRange = selectedRange || getChaseScoreRange(chaseTargetRuns);
        }
        compareData = chaseFilteredMatches;
    }

    if (selectedRange) {
        compareData = compareData.filter(match => {
            const score = match['20over'];
            if (!score) return false;
            const [matchRuns] = score.split('/').map(Number);
            return matchRuns >= selectedRange[0] && (selectedRange[1] === Infinity ? true : matchRuns <= selectedRange[1]);
        });
        chaseScoreRange = selectedRange;
    }

    const yearMatches = {};
    let totalMatches = 0;
    let runDifference = null;

    if (over <= 20) {
        compareData.forEach((match, index) => {
            const score = match[overKey];
            if (!score) return;
            const [histRuns, histWickets] = score.split('/').map(Number);
            if (histRuns === runs && histWickets === wickets) {
                const year = match['year'];
                if (!yearMatches[year]) yearMatches[year] = [];
                yearMatches[year].push({ match, index });
                totalMatches++;
            }
        });
    } else {
        runDifference = chaseTargetRuns - runs;
        compareData.forEach((match, index) => {
            const twentyOverScore = match['20over'];
            const currentOverScore = match[overKey];
            if (twentyOverScore && currentOverScore) {
                const [twentyRuns] = twentyOverScore.split('/').map(Number);
                const [currentRuns] = currentOverScore.split('/').map(Number);
                if (twentyRuns - currentRuns === runDifference) {
                    const year = match['year'];
                    if (!yearMatches[year]) yearMatches[year] = [];
                    yearMatches[year].push({ match, index });
                    totalMatches++;
                }
            }
        });
    }

    chaseAllYears = [...new Set(Object.keys(yearMatches).map(Number))].sort((a, b) => a - b);
    chaseAllScoreRanges = [];
    compareData.forEach(match => {
        const score = match['20over'];
        if (score) {
            const [runs] = score.split('/').map(Number);
            const range = getChaseScoreRange(runs);
            const rangeStr = range[1] === Infinity ? '200+' : `${range[0]}-${range[1]}`;
            if (!chaseAllScoreRanges.includes(rangeStr)) chaseAllScoreRanges.push(rangeStr);
        }
    });
    chaseAllScoreRanges.sort((a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0]));

    let html = `<p>Analysis for ${runs}/${wickets} after Over ${over}<br>`;
    if (over > 20 || selectedRange) {
        html += `20-Over Score Range: ${rangeStr || `${chaseScoreRange[0]}-${chaseScoreRange[1] === Infinity ? '200+' : chaseScoreRange[1]}`}<br>`;
    }
    if (over > 20) html += `Run Difference (20ov - ${over}ov): ${runDifference}<br>`;
    html += `Total matches: ${totalMatches}</p>`;

    if (totalMatches === 0) {
        html += `<p>No matches found with exact score ${runs}/${wickets} after Over ${over}${selectedRange ? ` within ${rangeStr}` : ''}.</p>`;
    } else {
        html += '<div class="filter-group">';
        html += '<button class="year-filter-btn" onclick="openChaseYearFilterModal()">Filter Years</button>';
        html += '<label for="scoreRangeFilter">Filter Score Range:</label>';
        html += '<select id="scoreRangeFilter" onchange="applyChaseFilters()"><option value="">All Score Ranges</option>';
        chaseAllScoreRanges.forEach(range => html += `<option value="${range}">${range}</option>`);
        html += '</select>';
        html += '<label for="resultFilter">Filter Result:</label>';
        html += '<select id="resultFilter" onchange="applyChaseFilters()"><option value="">All Results</option><option value="chased">Chased</option><option value="defend">Defend</option></select>';
        html += '</div>';

        html += '<div class="table-container"><table><thead><tr>';
        const headers = over <= 20 ? 
            ["Year", ...(over < 6 ? ["6ov"] : []), ...(over < 10 ? ["10ov"] : []), ...(over < 15 ? ["15ov"] : []), "20ov", "Result"] :
            ["Year", ...(over < 26 ? ["26ov"] : []), ...(over < 30 ? ["30ov"] : []), ...(over < 35 ? ["35ov"] : []), `${over}ov`, "20ov", "40ov", "15ov-6ov", "20ov-6ov", "Result"];
        headers.forEach(header => html += `<th>${header}</th>`);
        html += '</tr></thead><tbody id="tableBody">';

        const sortedRows = [];
        Object.keys(yearMatches).sort().forEach(year => {
            yearMatches[year].forEach(({ match }) => sortedRows.push({ year, match }));
        });
        sortedRows.sort((a, b) => a.year - b.year);
        chaseLastData = [];
        chaseSelectedYears = chaseAllYears.map(String);

        sortedRows.forEach(({ year, match }) => {
            const rowData = { Year: year, originalMatch: match };
            if (over <= 20) {
                if (over < 6) rowData['6ov'] = match['6over'] || "N/A";
                if (over < 10) rowData['10ov'] = match['10over'] || "N/A";
                if (over < 15) rowData['15ov'] = match['15over'] || "N/A";
                rowData['20ov'] = match['20over'] || "N/A";
                rowData['Result'] = match['result'] || "unknown";
            } else {
                if (over < 26) rowData['26ov'] = match['26over'] || "N/A";
                if (over < 30) rowData['30ov'] = match['30over'] || "N/A";
                if (over < 35) rowData['35ov'] = match['35over'] || "N/A";
                rowData[`${over}ov`] = match[overKey] || "N/A";
                rowData['20ov'] = match['20over'] || "N/A";
                rowData['40ov'] = match['40over'] || "N/A";
                rowData['15ov-6ov'] = calculateChaseDifference(match['15over'], match['6over']);
                rowData['20ov-6ov'] = calculateChaseDifference(match['20over'], match['6over']);
                rowData['Result'] = match['result'] || "unknown";
            }
            chaseLastData.push(rowData);
        });

        html += generateChaseTableRows(chaseLastData, over, runs, wickets);
        html += '</tbody></table></div>';

        const probabilities = calculateChaseProbabilities(chaseLastData);
        html += `<p>Chased: ${probabilities.chased}% | Defended: ${probabilities.defend}%</p>`;
        html += '<button class="back-to-top" onclick="scrollChaseToTop()">Back to Top</button>';
    }

    output.innerHTML = html;
    document.getElementById('viewDetailsBtn').disabled = totalMatches === 0;
    addChaseSortFunctionality();
}

function generateChaseTableRows(data, over, runs, wickets) {
    let html = '';
    data.forEach(row => {
        const overKey = `${over}ov`;
        const isHighlighted = isMatchInMatchAnalyzer(row);
        html += `<tr ${isHighlighted ? 'class="highlight-match"' : ''}>`;
        Object.entries(row).forEach(([key, value]) => {
            if (key !== 'originalMatch') html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });
    return html;
}

function applyChaseFilters() {
    const scoreRangeFilter = document.getElementById('scoreRangeFilter').value;
    const resultFilter = document.getElementById('resultFilter').value;
    const [runs, wickets] = parseChaseScore(document.getElementById('scoreInput').value);
    const over = parseInt(document.getElementById('overSelect').value);
    const filteredData = chaseLastData.filter(row => {
        const yearMatch = chaseSelectedYears.length === 0 || chaseSelectedYears.includes(row.Year.toString());
        const rangeMatch = !scoreRangeFilter || (() => {
            const [runs] = (row['20ov'] || '0/0').split('/').map(Number);
            const range = parseChaseRange(scoreRangeFilter);
            return runs >= range[0] && (range[1] === Infinity ? true : runs <= range[1]);
        })();
        const resultMatch = !resultFilter || row.Result.toLowerCase() === resultFilter;
        return yearMatch && rangeMatch && resultMatch;
    });
    document.getElementById('tableBody').innerHTML = generateChaseTableRows(filteredData, over, runs, wickets);
    const probabilities = calculateChaseProbabilities(filteredData);
    document.getElementById('output').innerHTML = document.getElementById('output').innerHTML.split('<p>Chased')[0] + 
        `<p>Chased: ${probabilities.chased}% | Defended: ${probabilities.defend}%</p>` +
        '<button class="back-to-top" onclick="scrollChaseToTop()">Back to Top</button>';
    document.getElementById('viewDetailsBtn').disabled = filteredData.length === 0;
    addChaseSortFunctionality();
}

function addChaseSortFunctionality() {
    const table = document.querySelector('#output table');
    if (!table) return;
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = header.dataset.sort !== 'asc';
            rows.sort((a, b) => {
                const aValue = a.cells[index].textContent;
                const bValue = b.cells[index].textContent;
                if (header.textContent === 'Year') return isAscending ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
                if (aValue.includes('/') && bValue.includes('/')) {
                    const [runsA] = aValue.split('/').map(Number);
                    const [runsB] = bValue.split('/').map(Number);
                    return isAscending ? runsA - runsB : runsB - runsA;
                }
                return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });
            headers.forEach(h => delete h.dataset.sort);
            header.dataset.sort = isAscending ? 'asc' : 'desc';
            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

function getChaseScoreRange(runs) {
    if (runs >= 200) return [200, Infinity];
    const rangeStart = Math.floor(runs / 10) * 10;
    return [rangeStart, rangeStart + 9];
}

function viewChaseFullMatchDetails() {
    const modal = document.getElementById('fullDetailsModal');
    const outputDiv = document.getElementById('fullDetailsOutput');
    if (!chaseLastData || chaseLastData.length === 0) {
        outputDiv.textContent = "No data available.";
        modal.style.display = 'flex';
        return;
    }
    const scoreRangeFilter = document.getElementById('scoreRangeFilter') ? document.getElementById('scoreRangeFilter').value : '';
    const resultFilter = document.getElementById('resultFilter') ? document.getElementById('resultFilter').value : '';
    const filteredData = chaseLastData.filter(row => {
        const yearMatch = chaseSelectedYears.length === 0 || chaseSelectedYears.includes(row.Year.toString());
        const rangeMatch = !scoreRangeFilter || (() => {
            const [runs] = (row['20ov'] || '0/0').split('/').map(Number);
            const range = parseChaseRange(scoreRangeFilter);
            return runs >= range[0] && (range[1] === Infinity ? true : runs <= range[1]);
        })();
        const resultMatch = !resultFilter || row.Result.toLowerCase() === resultFilter;
        return yearMatch && rangeMatch && resultMatch;
    });
    if (filteredData.length === 0) {
        outputDiv.textContent = "No matches match the current filters.";
    } else {
        const allKeys = [...new Set(filteredData.flatMap(row => Object.keys(row.originalMatch)))];
        let html = '<table><thead><tr>' + allKeys.map(key => `<th>${key}</th>`).join('') + '</tr></thead><tbody>';
        filteredData.forEach(row => {
            html += '<tr>' + allKeys.map(key => `<td>${row.originalMatch[key] || 'N/A'}</td>`).join('') + '</tr>';
        });
        html += '</tbody></table>';
        outputDiv.innerHTML = html;
    }
    modal.style.display = 'flex';
    addChaseModalSortFunctionality();
}

function addChaseModalSortFunctionality() {
    const table = document.querySelector('#fullDetailsOutput table');
    if (!table) return;
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = header.dataset.sort !== 'asc';
            rows.sort((a, b) => {
                const aValue = a.cells[index].textContent;
                const bValue = b.cells[index].textContent;
                if (header.textContent === 'year') return isAscending ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
                if (aValue.includes('/') && bValue.includes('/')) {
                    const [runsA] = aValue.split('/').map(Number);
                    const [runsB] = bValue.split('/').map(Number);
                    return isAscending ? runsA - runsB : runsB - runsA;
                }
                return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });
            headers.forEach(h => delete h.dataset.sort);
            header.dataset.sort = isAscending ? 'asc' : 'desc';
            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

function openChaseYearFilterModal() {
    const modal = document.getElementById('yearFilterModal');
    const checkboxesDiv = document.getElementById('yearCheckboxes');
    let html = '';
    chaseAllYears.forEach(year => {
        const isChecked = chaseSelectedYears.length === 0 || chaseSelectedYears.includes(year.toString());
        html += `<label class="year-checkbox-label"><input type="checkbox" class="year-checkbox" value="${year}" ${isChecked ? 'checked' : ''}>${year}</label>`;
    });
    checkboxesDiv.innerHTML = html;
    modal.style.display = 'flex';
}

function closeChaseYearFilterModal() {
    document.getElementById('yearFilterModal').style.display = 'none';
}

function applyChaseYearFilter() {
    const yearCheckboxes = document.querySelectorAll('.year-checkbox:checked');
    chaseSelectedYears = Array.from(yearCheckboxes).map(cb => cb.value);
    closeChaseYearFilterModal();
    applyChaseFilters();
}

function closeChaseFullDetailsModal() {
    document.getElementById('fullDetailsModal').style.display = 'none';
}

function scrollChaseToTop() {
    document.getElementById('output').scrollTop = 0;
}

let matchMatches = [];
let matchLastData = [];
let matchAllYears = [];
let matchSelectedYears = [];
const matchScoreRanges = ['120-129', '130-139', '140-149', '150-159', '160-169', '170-179', '180-189', '190-199', '200-210', '210-220', '220-230', '230-300'];

function parseMatchScore(scoreWickets) {
    if (!scoreWickets) return [null, null];
    const parts = scoreWickets.split('/');
    if (parts.length !== 2) return [null, null];
    const runs = parseInt(parts[0]);
    const wickets = parseInt(parts[1]);
    if (isNaN(runs) || isNaN(wickets) || wickets < 0 || wickets > 10) return [null, null];
    return [runs, wickets];
}

function calculateMatchDifferences(runsLater, wicketsLater, runsEarlier, wicketsEarlier) {
    if (runsLater === null || wicketsLater === null || runsEarlier === null || wicketsEarlier === null) return null;
    return `${runsLater - runsEarlier}/${wicketsLater - wicketsEarlier}`;
}

function calculateMatchProbabilities(data) {
    const validResults = data.filter(row => row['Result'].toLowerCase() === 'chased' || row['Result'].toLowerCase() === 'defend');
    const totalValid = validResults.length;
    if (totalValid === 0) return { chased: 0, defend: 0 };
    const chasedCount = validResults.filter(row => row['Result'].toLowerCase() === 'chased').length;
    return {
        chased: (chasedCount / totalValid * 100).toFixed(2),
        defend: ((totalValid - chasedCount) / totalValid * 100).toFixed(2)
    };
}

function processMatchInput() {
    const score6ov = document.getElementById('score6ov').value.trim();
    const score10ov = document.getElementById('score10ov').value.trim();
    const score15ov = document.getElementById('score15ov').value.trim();
    const score20ov = document.getElementById('score20ov').value.trim();
    const [runs6, wickets6] = parseMatchScore(score6ov);
    const [runs10, wickets10] = parseMatchScore(score10ov);
    const [runs15, wickets15] = parseMatchScore(score15ov);
    const [runs20, wickets20] = parseMatchScore(score20ov);

    if (!score6ov && !score10ov && !score15ov && !score20ov) {
        document.getElementById('match-output').textContent = "Please enter at least one valid score/wickets (e.g., '20/1').";
        return;
    }

    const inputScores = {
        '6over': [runs6, wickets6],
        '10over': [runs10, wickets10],
        '15over': [runs15, wickets15],
        '20over': [runs20, wickets20],
        '10-6': calculateMatchDifferences(runs10, wickets10, runs6, wickets6),
        '15-10': calculateMatchDifferences(runs15, wickets15, runs10, wickets10),
        '15-6': calculateMatchDifferences(runs15, wickets15, runs6, wickets6),
        '20-6': calculateMatchDifferences(runs20, wickets20, runs6, wickets6),
        '20-10': calculateMatchDifferences(runs20, wickets20, runs10, wickets10),
        '20-15': calculateMatchDifferences(runs20, wickets20, runs15, wickets15)
    };

    const matchedMatches = [];
    matchMatches.forEach(match => {
        const matchScores = {
            '6over': match['6over'] ? match['6over'].split('/').map(Number) : [null, null],
            '10over': match['10over'] ? match['10over'].split('/').map(Number) : [null, null],
            '15over': match['15over'] ? match['15over'].split('/').map(Number) : [null, null],
            '20over': match['20over'] ? match['20over'].split('/').map(Number) : [null, null]
        };
        const matchDiffs = {
            '10-6': calculateMatchDifferences(matchScores['10over'][0], matchScores['10over'][1], matchScores['6over'][0], matchScores['6over'][1]),
            '15-10': calculateMatchDifferences(matchScores['15over'][0], matchScores['15over'][1], matchScores['10over'][0], matchScores['10over'][1]),
            '15-6': calculateMatchDifferences(matchScores['15over'][0], matchScores['15over'][1], matchScores['6over'][0], matchScores['6over'][1]),
            '20-6': calculateMatchDifferences(matchScores['20over'][0], matchScores['20over'][1], matchScores['6over'][0], matchScores['6over'][1]),
            '20-10': calculateMatchDifferences(matchScores['20over'][0], matchScores['20over'][1], matchScores['10over'][0], matchScores['10over'][1]),
            '20-15': calculateMatchDifferences(matchScores['20over'][0], matchScores['20over'][1], matchScores['15over'][0], matchScores['15over'][1])
        };

        let matchCount = 0;
        const matchesAt = [];
        const matchesWicketsAt = [];

        for (const over in inputScores) {
            if (['6over', '10over', '15over', '20over'].includes(over)) {
                const [inputRuns, inputWickets] = inputScores[over];
                const [matchRuns, matchWickets] = matchScores[over];
                if (inputRuns !== null && matchRuns === inputRuns) {
                    matchCount++;
                    matchesAt.push(over);
                    if (inputWickets !== null && matchWickets === inputWickets) matchesWicketsAt.push(over);
                }
            } else {
                const inputDiff = inputScores[over];
                const matchDiff = matchDiffs[over];
                if (inputDiff && matchDiff) {
                    const [inputRunsDiff, inputWicketsDiff] = inputDiff.split('/').map(Number);
                    const [matchRunsDiff, matchWicketsDiff] = matchDiff.split('/').map(Number);
                    if (inputRunsDiff === matchRunsDiff) {
                        matchCount++;
                        matchesAt.push(over);
                        if (inputWicketsDiff === matchWicketsDiff) matchesWicketsAt.push(over);
                    }
                }
            }
        }

        if (matchCount > 0) {
            matchedMatches.push({
                match,
                matchCount,
                matchesAt,
                matchesWicketsAt,
                '6over': match['6over'] || 'N/A',
                '10over': match['10over'] || 'N/A',
                '15over': match['15over'] || 'N/A',
                '20over': match['20over'] || 'N/A',
                '10-6': matchDiffs['10-6'] || 'N/A',
                '15-10': matchDiffs['15-10'] || 'N/A',
                '15-6': matchDiffs['15-6'] || 'N/A',
                '20-6': matchDiffs['20-6'] || 'N/A',
                '20-10': matchDiffs['20-10'] || 'N/A',
                '20-15': matchDiffs['20-15'] || 'N/A',
                'Result': match['result'] || 'unknown'
            });
        }
    });

    matchLastData = matchedMatches;
    displayMatchResults(matchLastData);
}

function displayMatchResults(data) {
    const output = document.getElementById('match-output');
    let html = `<p>Matches found: ${data.length}</p>`;
    if (data.length === 0) {
        html += '<p>No matches found.</p>';
    } else {
        html += '<div class="filter-group">';
        html += '<button class="year-filter-btn" onclick="openMatchYearFilterModal()">Filter Years</button>';
        html += '<label for="matchFilter">Filter by Matches:</label>';
        html += '<select id="matchFilter" onchange="applyMatchFilters()">';
        html += '<option value="">All Matches</option>';
        for (let i = 1; i <= 10; i++) html += `<option value="${i}">${i} Field${i > 1 ? 's' : ''} Match</option>`;
        html += '</select>';
        html += '<label for="matchScoreRangeFilter">20-Over Score Range:</label>';
        html += '<select id="matchScoreRangeFilter" onchange="applyMatchFilters()">';
        html += '<option value="">All Ranges</option>';
        matchScoreRanges.forEach(range => html += `<option value="${range}">${range}</option>`);
        html += '</select>';
        html += '</div>';

        html += '<div class="table-container"><table><thead><tr>';
        const headers = ['Year', '6ov', '10ov', '15ov', '20ov', '10-6', '15-10', '15-6', '20-6', '20-10', '20-15', 'Result'];
        headers.forEach(header => html += `<th>${header}</th>`);
        html += '</tr></thead><tbody id="matchTableBody">';

        html += generateMatchTableRows(data);
        html += '</tbody></table></div>';

        const probabilities = calculateMatchProbabilities(data);
        html += `<p id="matchProbability">Chased: ${probabilities.chased}% | Defended: ${probabilities.defend}%</p>`;
        html += '<button class="back-to-top" onclick="scrollMatchToTop()">Back to Top</button>';
    }

    output.innerHTML = html;
    document.getElementById('matchViewDetailsBtn').disabled = data.length === 0;
    addMatchSortFunctionality();
}

function generateMatchTableRows(data) {
    return data.map(row => {
        const cells = [];
        // Year cell (no highlight)
        cells.push(`<td>${row.match['year']}</td>`);

        // Over cells (6ov, 10ov, 15ov, 20ov)
        ['6over', '10over', '15over', '20over'].forEach(over => {
            let cellClass = '';
            const overKey = over.replace('over', 'ov');
            if (row.matchesAt.includes(over)) {
                cellClass = `match-${overKey}`;
                if (row.matchesWicketsAt.includes(over)) {
                    cellClass = `match-${overKey}-wickets`;
                }
            }
            cells.push(`<td class="${cellClass}">${row[over] || 'N/A'}</td>`);
        });

        // Difference cells (10-6, 15-10, etc.)
        ['10-6', '15-10', '15-6', '20-6', '20-10', '20-15'].forEach(diff => {
            let cellClass = '';
            if (row.matchesAt.includes(diff)) {
                cellClass = `match-${diff}`;
                if (row.matchesWicketsAt.includes(diff)) {
                    cellClass = `match-${diff}-wickets`;
                }
            }
            cells.push(`<td class="${cellClass}">${row[diff] || 'N/A'}</td>`);
        });

        // Result cell (no highlight)
        cells.push(`<td>${row['Result']}</td>`);

        return `<tr>${cells.join('')}</tr>`;
    }).join('');
}

function applyMatchFilters() {
    const yearCheckboxes = document.querySelectorAll('.match-year-checkbox:checked');
    const selectedYears = Array.from(yearCheckboxes).map(cb => cb.value);
    const matchFilter = document.getElementById('matchFilter').value;
    const scoreRangeFilter = document.getElementById('matchScoreRangeFilter').value;

    const filteredData = matchLastData.filter(row => {
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(row.match['year']);
        const matchCountMatch = !matchFilter || row.matchCount >= parseInt(matchFilter);
        const rangeMatch = !scoreRangeFilter || (() => {
            const [runs] = (row['20over'] || '0/0').split('/').map(Number);
            const [min, max] = scoreRangeFilter.split('-').map(Number);
            return runs >= min && runs <= max;
        })();
        return yearMatch && matchCountMatch && rangeMatch;
    });

    document.getElementById('matchTableBody').innerHTML = generateMatchTableRows(filteredData);
    const probabilities = calculateMatchProbabilities(filteredData);
    document.getElementById('matchProbability').innerHTML = `Chased: ${probabilities.chased}% | Defended: ${probabilities.defend}%`;
    document.getElementById('matchViewDetailsBtn').disabled = filteredData.length === 0;
    addMatchSortFunctionality();
}

function addMatchSortFunctionality() {
    const table = document.querySelector('#match-output table');
    if (!table) return;
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = header.dataset.sort !== 'asc';
            rows.sort((a, b) => {
                const aValue = a.cells[index].textContent;
                const bValue = b.cells[index].textContent;
                if (header.textContent === 'Year') return isAscending ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
                if (aValue.includes('/') && bValue.includes('/')) {
                    const [runsA] = aValue.split('/').map(Number);
                    const [runsB] = bValue.split('/').map(Number);
                    return isAscending ? runsA - runsB : runsB - runsA;
                }
                return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });
            headers.forEach(h => delete h.dataset.sort);
            header.dataset.sort = isAscending ? 'asc' : 'desc';
            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

function openMatchYearFilterModal() {
    const modal = document.getElementById('matchYearFilterModal');
    const checkboxesDiv = document.getElementById('matchYearCheckboxes');
    let html = '';
    matchAllYears.forEach(year => {
        const isChecked = matchSelectedYears.length === 0 || matchSelectedYears.includes(year.toString());
        html += `<label class="year-checkbox-label"><input type="checkbox" class="match-year-checkbox" value="${year}" ${isChecked ? 'checked' : ''}>${year}</label>`;
    });
    checkboxesDiv.innerHTML = html;
    modal.style.display = 'flex';
}

function closeMatchYearFilterModal() {
    document.getElementById('matchYearFilterModal').style.display = 'none';
}

function applyMatchYearFilter() {
    const yearCheckboxes = document.querySelectorAll('.match-year-checkbox:checked');
    matchSelectedYears = Array.from(yearCheckboxes).map(cb => cb.value);
    closeMatchYearFilterModal();
    applyMatchFilters();
}

function viewMatchFullDetails() {
    const modal = document.getElementById('matchFullDetailsModal');
    const outputDiv = document.getElementById('matchFullDetailsOutput');
    if (!matchLastData || matchLastData.length === 0) {
        outputDiv.textContent = "No data available.";
        modal.style.display = 'flex';
        return;
    }
    const matchFilter = document.getElementById('matchFilter') ? document.getElementById('matchFilter').value : '';
    const scoreRangeFilter = document.getElementById('matchScoreRangeFilter') ? document.getElementById('matchScoreRangeFilter').value : '';
    const filteredData = matchLastData.filter(row => {
        const yearMatch = matchSelectedYears.length === 0 || matchSelectedYears.includes(row.match['year']);
        const matchCountMatch = !matchFilter || row.matchCount >= parseInt(matchFilter);
        const rangeMatch = !scoreRangeFilter || (() => {
            const [runs] = (row['20over'] || '0/0').split('/').map(Number);
            const [min, max] = scoreRangeFilter.split('-').map(Number);
            return runs >= min && runs <= max;
        })();
        return yearMatch && matchCountMatch && rangeMatch;
    });
    if (filteredData.length === 0) {
        outputDiv.textContent = "No matches match the current filters.";
    } else {
        const allKeys = [...new Set(filteredData.flatMap(row => Object.keys(row.match)))];
        let html = '<table><thead><tr>' + allKeys.map(key => `<th>${key}</th>`).join('') + '</tr></thead><tbody>';
        filteredData.forEach(row => {
            html += '<tr>' + allKeys.map(key => `<td>${row.match[key] || 'N/A'}</td>`).join('') + '</tr>';
        });
        html += '</tbody></table>';
        outputDiv.innerHTML = html;
    }
    modal.style.display = 'flex';
    addMatchModalSortFunctionality();
}

function addMatchModalSortFunctionality() {
    const table = document.querySelector('#matchFullDetailsOutput table');
    if (!table) return;
    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
        header.addEventListener('click', () => {
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = header.dataset.sort !== 'asc';
            rows.sort((a, b) => {
                const aValue = a.cells[index].textContent;
                const bValue = b.cells[index].textContent;
                if (header.textContent === 'year') return isAscending ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
                if (aValue.includes('/') && bValue.includes('/')) {
                    const [runsA] = aValue.split('/').map(Number);
                    const [runsB] = bValue.split('/').map(Number);
                    return isAscending ? runsA - runsB : runsB - runsA;
                }
                return isAscending ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            });
            headers.forEach(h => delete h.dataset.sort);
            header.dataset.sort = isAscending ? 'asc' : 'desc';
            tbody.innerHTML = '';
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

function closeMatchFullDetailsModal() {
    document.getElementById('matchFullDetailsModal').style.display = 'none';
}

function scrollMatchToTop() {
    document.getElementById('match-output').scrollTop = 0;
}
