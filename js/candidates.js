// Candidates loading module
let candidatesCache = null;

// Fetch and cache candidates data
function loadCandidates(callback) {
  if (candidatesCache) {
    callback(candidatesCache);
    return;
  }
  
  $.get('data/candidates.json', function(data) {
    if (!data.ok) {
      console.error('Failed to load candidates');
      return;
    }
    candidatesCache = data.candidates;
    callback(candidatesCache);
  }).fail(function(err) {
    console.error('Failed to fetch candidates:', err);
  });
}

// Get candidates for a specific position
function getCandidatesForPosition(positionId) {
  if (!candidatesCache) return [];
  return candidatesCache.filter(c => c.position_id === positionId);
}

// Populate select dropdown with candidates
function populateCandidatesDropdown(positionId, selectEl) {
  loadCandidates(function(candidates) {
    const positionCandidates = candidates.filter(c => c.position_id === positionId);
    positionCandidates.forEach(function(c) {
      selectEl.append(`<option value="${c.id}" class="bg-gray-900 text-white">${c.name}</option>`);
    });
  });
}
