// index.js
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    // Review form logic
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.onsubmit = function(e) {
            e.preventDefault();
            document.getElementById('review-success').style.display = 'block';
            reviewForm.style.display = 'none';
            // Here you could send the review to a server if desired
        };
    }
});

function initApp() {
    const form = document.getElementById('handle-form');
    const landingPage = document.getElementById('landing-page');
    const profileVisualizer = document.getElementById('profile-visualizer');
    const handleInput = document.getElementById('cf-handle');

    if (form) {
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            const handle = handleInput.value.trim();
            if (!handle) return;

            // Show loading state (optional)
            form.querySelector('button').disabled = true;
            form.querySelector('button').textContent = 'Loading...';

            // Fetch and display user data
            const success = await fetchAndDisplayProfile(handle);

            // Hide loading state
            form.querySelector('button').disabled = false;
            form.querySelector('button').textContent = 'Visualize';

            if (success) {
                landingPage.style.display = 'none';
                profileVisualizer.style.display = 'block';
            } else {
                alert('User not found or API error. Please check the handle and try again.');
            }
        });
    }
}

async function fetchAndDisplayProfile(handle) {
    try {
        // 1. Fetch user info
        const userInfoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
        const userInfoData = await userInfoRes.json();
        if (userInfoData.status !== 'OK') {
            console.error('User info API error:', userInfoData);
            return false;
        }
        const user = userInfoData.result[0];

        // 2. Fetch user rating history
        const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
        const ratingData = await ratingRes.json();
        const ratingHistory = ratingData.status === 'OK' ? ratingData.result : [];
        if (ratingData.status !== 'OK') {
            console.warn('Rating history API error:', ratingData);
        }

        // 3. Fetch user submissions (for solved problems, tags, languages)
        const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
        const statusData = await statusRes.json();
        const submissions = statusData.status === 'OK' ? statusData.result : [];
        if (statusData.status !== 'OK') {
            console.warn('User status API error:', statusData);
        }

        // 4. Update profile info
        document.getElementById('profile-avatar').src = user.titlePhoto || 'https://sta.codeforces.com/s/42107/images/codeforces-logo-with-telegram.png';
        document.getElementById('profile-username').textContent = user.handle;
        document.getElementById('profile-username-link').href = `https://codeforces.com/profile/${user.handle}`;
        document.getElementById('profile-rank').textContent = `Rank: ${user.rank || 'Unrated'}`;
        document.getElementById('profile-rating').textContent = `Rating: ${user.rating || '--'}`;
        document.getElementById('profile-max-rating').innerHTML = `Max Rating: ${user.maxRating || '--'} <span id="profile-max-rank" class="max-rank">${getRankFromRating(user.maxRating)}</span>`;
        document.getElementById('contribution').textContent = user.contribution || '0';
        document.getElementById('friend-count').textContent = user.friendOfCount || '0';

        // 5. Solved problems count
        const solvedSet = new Set();
        submissions.forEach(sub => {
            if (sub.verdict === 'OK' && sub.problem) {
                solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
            }
        });
        document.getElementById('solved-count').textContent = solvedSet.size;

        // 6. Contest count (from rating history)
        document.getElementById('contest-count').textContent = ratingHistory.length;

        // 7. Prepare data for charts
        updateRatingChart(ratingHistory);
        updateTagsChart(submissions);
        updateLanguagesChart(submissions);
        updateRatingsChart(submissions);
        updateLevelsChart(submissions, user.handle);

        // 8. Calculate and fill in summary stats
        const summaryTable = document.querySelector('.summary-table');
        const summaryUsername = document.getElementById('summary-username');

        // Calculate new stats
        const problemAttempts = {};
        const firstTrySolved = new Set();
        const ratingsSolved = [];

        submissions.forEach(sub => {
            if (!sub.problem) return;
            const key = `${sub.problem.contestId}-${sub.problem.index}`;
            if (!problemAttempts[key]) problemAttempts[key] = [];
            problemAttempts[key].push(sub);
        });

        Object.entries(problemAttempts).forEach(([key, subs]) => {
            const sortedSubs = subs.sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);
            const acceptedIndex = sortedSubs.findIndex(s => s.verdict === 'OK');
            if (acceptedIndex !== -1) {
                if (acceptedIndex === 0) firstTrySolved.add(key);
                const rating = sortedSubs[acceptedIndex]?.problem?.rating;
                if (rating) ratingsSolved.push(rating);
            }
        });

        const triedCount = Object.keys(problemAttempts).length;
        const solvedCount = ratingsSolved.length;
        const successRate = triedCount > 0 ? ((solvedCount / triedCount) * 100).toFixed(1) + '%' : '--';
        const firstTryCount = firstTrySolved.size;
        const hardestProblem = ratingsSolved.length > 0 ? Math.max(...ratingsSolved) : '--';

        summaryTable.querySelector('td#tried-count').textContent = triedCount;
        summaryTable.querySelector('td#solved-count-table').textContent = solvedCount;
        summaryTable.querySelector('td#avg-attempts').textContent = successRate;
        summaryTable.querySelector('td#max-attempts').textContent = firstTryCount;
        summaryTable.querySelector('td#one-submission').textContent = hardestProblem;
        summaryUsername.textContent = user.handle;

        // 9. Calculate and fill in contests stats
        const contestsTable = document.querySelector('.summary-table:last-child');
        const contestsUsername = document.getElementById('contests-username');
        const contestNum = ratingHistory.length;
        const bestRank = ratingHistory.length > 0 ? ratingHistory.reduce((min, r) => Math.min(min, r.rank), Infinity).toString() : '--';
        const worstRank = ratingHistory.length > 0 ? ratingHistory.reduce((max, r) => Math.max(max, r.rank), 0).toString() : '--';
        const maxUp = ratingHistory.length > 0 ? (ratingHistory.reduce((max, r) => Math.max(max, r.newRating - r.oldRating), 0)).toString() : '--';
        const maxDown = ratingHistory.length > 0 ? (ratingHistory.reduce((min, r) => Math.min(min, r.newRating - r.oldRating), 0)).toString() : '--';

        contestsTable.querySelector('td#contest-num').textContent = contestNum;
        contestsTable.querySelector('td#best-rank').textContent = bestRank;
        contestsTable.querySelector('td#worst-rank').textContent = worstRank;
        contestsTable.querySelector('td#max-up').textContent = maxUp;
        contestsTable.querySelector('td#max-down').textContent = maxDown;
        contestsUsername.textContent = user.handle;

        return true;
    } catch (err) {
        console.error('Network or parsing error:', err);
        return false;
    }
}

function updateRatingChart(ratingHistory) {
    const ctx = document.getElementById('ratingChart').getContext('2d');
    const labels = ratingHistory.map(r => new Date(r.ratingUpdateTimeSeconds * 1000).toLocaleDateString());
    const data = ratingHistory.map(r => r.newRating);
    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Rating',
                data,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.3,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: 'Date' }},
                y: { title: { display: true, text: 'Rating' }}
            }
        }
    });
}

function updateTagsChart(submissions) {
    const tagCounts = {};
    submissions.forEach(sub => {
        if (sub.verdict === 'OK' && sub.problem?.tags) {
            sub.problem.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });
    const tags = Object.keys(tagCounts);
    const counts = Object.values(tagCounts);
    const ctx = document.getElementById('tagsChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tags,
            datasets: [{
                label: 'Problems Solved',
                data: counts,
                backgroundColor: '#28a745'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Problems Solved' }},
                y: { title: { display: true, text: 'Tags' }}
            }
        }
    });
}

function updateLanguagesChart(submissions) {
    const langCounts = {};
    submissions.forEach(sub => {
        if (sub.verdict === 'OK') {
            const lang = sub.programmingLanguage;
            langCounts[lang] = (langCounts[lang] || 0) + 1;
        }
    });
    const languages = Object.keys(langCounts);
    const counts = Object.values(langCounts);
    const ctx = document.getElementById('languagesChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: languages,
            datasets: [{
                label: 'Languages Used',
                data: counts,
                backgroundColor: languages.map(() => `hsl(${Math.random() * 360}, 70%, 60%)`)
            }]
        },
        options: {
            responsive: true,
        }
    });
}

function updateRatingsChart(submissions) {
    const canvas = document.getElementById('ratingsChart');
    if (!canvas) {
        console.warn('ratingsChart canvas not found!');
        return;
    }
    const ratingCounts = {};
    submissions.forEach(sub => {
        if (sub.verdict === 'OK' && sub.problem?.rating) {
            const rating = sub.problem.rating;
            ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
        }
    });
    const sortedRatings = Object.keys(ratingCounts).map(Number).sort((a, b) => a - b);
    const counts = sortedRatings.map(r => ratingCounts[r]);
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedRatings,
            datasets: [{
                label: 'Problems Solved',
                data: counts,
                backgroundColor: '#ffc107'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Rating' }
                },
                y: {
                    title: { display: true, text: 'Solved Count' },
                    beginAtZero: true
                }
            }
        }
    });
}

function updateLevelsChart(submissions, username) {
    const levelCounts = {};
    submissions.forEach(sub => {
        if (sub.verdict === 'OK' && sub.problem?.index) {
            // The first character of the problem index is the level (A, B, C, etc.)
            const level = sub.problem.index[0].toUpperCase();
            levelCounts[level] = (levelCounts[level] || 0) + 1;
        }
    });

    const levels = Object.keys(levelCounts).sort();
    const counts = levels.map(lvl => levelCounts[lvl]);

    const canvas = document.getElementById('levelsChart');
    if (!canvas) {
        console.warn('levelsChart canvas not found!');
        return;
    }
    const ctx = canvas.getContext('2d');

    // Destroy previous chart if it exists
    if (window.levelsChartInstance) {
        window.levelsChartInstance.destroy();
    }

    window.levelsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: levels,
            datasets: [{
                label: 'Problems Solved',
                data: counts,
                backgroundColor: '#3b5bdb'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Levels of ${username}`
                }
            },
            scales: {
                x: { title: { display: true, text: 'Level' }},
                y: { title: { display: true, text: 'Solved Count' }, beginAtZero: true }
            }
        }
    });
}

function getRankFromRating(rating) {
    if (!rating) return '';
    rating = Number(rating);
    if (rating < 1200) return 'Newbie';
    if (rating < 1400) return 'Pupil';
    if (rating < 1600) return 'Specialist';
    if (rating < 1900) return 'Expert';
    if (rating < 2100) return 'Candidate Master';
    if (rating < 2300) return 'Master';
    if (rating < 2400) return 'International Master';
    if (rating < 2600) return 'Grandmaster';
    if (rating < 3000) return 'International Grandmaster';
    return 'Legendary Grandmaster';
}
