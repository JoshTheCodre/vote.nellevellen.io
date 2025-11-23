// Always send cookies/session with AJAX
$.ajaxSetup({
  xhrFields: { withCredentials: true }
});

// Countdown Timer (Election ends in 3 days from now)
function initCountdown() {
  const electionEndTime = new Date().getTime() + (3 * 24 * 60 * 60 * 1000); // 3 days from now
  
  function updateCountdown() {
    const now = new Date().getTime();
    const timeLeft = electionEndTime - now;
    
    if (timeLeft <= 0) {
      $('#countdown').text('ELECTION ENDED');
      return;
    }
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    $('#countdown').text(
      `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );
  }
  
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// Load and render voting positions
function loadPositions() {
  const path = window.location.pathname.includes('/pages/') ? '../data/positions.json' : 'data/positions.json';
  $.get(path, function(r) {
    if (!r.ok) return;
    renderPositions(r.positions);
  }).fail(function(err) {
    console.error('Failed to load positions:', err);
  });
}

function renderPositions(positionsData) {
  if (!positionsData) return;
  
  const grid = $('#positionsGrid');
  grid.html('');

  // Get voted positions from current user
  const userVotes = JSON.parse(localStorage.getItem(`votes_${currentVoterId}`) || '[]');
  const votedPositions = new Set(userVotes.map(v => v.position_id));
  
  renderPositionCards(positionsData, votedPositions, grid);
}

function renderPositionCards(positionsData, votedPositions, grid) {
  positionsData.forEach(function(p) {
    const voted = votedPositions.has(p.id);
    const html = `
      <div class="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:border-green-300 transform hover:-translate-y-1" data-position-id="${p.id}">
        ${voted ? '<div class="mb-4 inline-flex items-center gap-2 bg-green-50 border border-green-300 px-3 py-1 rounded-full"><svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg><span class="text-green-600 text-sm font-semibold">Voted</span></div>' : ''}
        <div class="mb-4">
          <div class="h-1.5 w-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full mb-4"></div>
          <h3 class="text-lg font-bold text-gray-900 mb-1">${p.name}</h3>
          <p class="text-sm text-gray-600">Select your preferred candidate</p>
        </div>
        <select class="w-full px-4 py-3 mb-4 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition duration-200 appearance-none cursor-pointer" data-position-id="${p.id}" ${voted ? 'disabled' : ''}>
          <option value="" selected hidden>Choose candidate...</option>
        </select>
        <button class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg" data-position-id="${p.id}" ${voted ? 'disabled' : ''}>Vote Now</button>
      </div>
    `;
    grid.append(html);

    // Load candidates for this position
    const selectEl = grid.find(`select[data-position-id="${p.id}"]`);
    populateCandidatesDropdown(p.id, selectEl);

    // Handle vote button click
    const voteBtn = grid.find(`[data-position-id="${p.id}"] button`);
    voteBtn.on('click', function() {
      const candidate_id = parseInt(selectEl.val() || '0', 10);
      const candidate_name = selectEl.find('option:selected').text();
      handleVoteClick(p, candidate_id, candidate_name, selectEl, voteBtn);
    });
  });
}

// Initialize on page load
$(function() {
  // Initialize user session (from voting.js)
  initUserSession();
  
  // Start countdown
  initCountdown();
  
  // Load positions if on voting page
  if ($('#positionsGrid').length) {
    loadPositions();
  }
  
  // Load results if on results page
  if ($('#allCandidatesTable').length) {
    loadResults();
    setInterval(loadResults, 5000);
  }
});

