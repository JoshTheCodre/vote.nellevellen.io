// Results module
function loadResults() {
  // Fetch positions and candidates
  $.get('../data/positions.json', function(positions) {
    if (!positions.ok) {
      console.error('Positions data missing ok flag:', positions);
      return;
    }
    
    $.get('../data/candidates.json', function(candidates) {
      if (!candidates.ok) {
        console.error('Candidates data missing ok flag:', candidates);
        return;
      }
      
      renderResults({
        ok: true,
        positions: positions.positions,
        candidates: candidates.candidates
      });
    }).fail(function(err) {
      console.error('Failed to load candidates:', err);
    });
  }).fail(function(err) {
    console.error('Failed to load positions:', err);
  });
}

function renderResults(data) {
  if (!data.ok) return;

  // Aggregate votes from all users (localStorage)
  const allVotes = [];
  
  // Get all votes from all users in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('votes_')) {
      const userVotes = JSON.parse(localStorage.getItem(key) || '[]');
      allVotes.push(...userVotes);
    }
  }
  
  // Count votes per candidate
  const voteCount = {};
  allVotes.forEach(vote => {
    voteCount[vote.candidate_id] = (voteCount[vote.candidate_id] || 0) + 1;
  });
  
  // Calculate total votes
  const totalVotes = allVotes.length;

  // All candidates table
  const tbody = $('#allCandidatesTable');
  if (tbody.length) {
    tbody.html('');
    if (data.candidates && data.candidates.length) {
      data.candidates.forEach(function(c, idx) {
        const position = data.positions.find(p => p.id === c.position_id);
        const positionName = position ? position.name : 'Unknown';
        const candidateVotes = voteCount[c.id] || 0;
        const percentage = totalVotes > 0 ? ((candidateVotes / totalVotes) * 100).toFixed(1) : 0;
        
        tbody.append(`
          <tr class="border-b border-white/20 hover:bg-white/5 transition duration-200">
            <td class="px-6 py-3 font-medium">${idx + 1}</td>
            <td class="px-6 py-3">${c.name}</td>
            <td class="px-6 py-3 text-sm text-white/75">${positionName}</td>
            <td class="px-6 py-3 text-right">
              <div class="flex items-center justify-end gap-3">
                <div class="w-32 bg-white/10 rounded-full h-2 border border-white/20">
                  <div class="bg-gradient-to-r from-green-400 to-emerald-400 h-full rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
                </div>
                <span class="font-semibold text-green-300 min-w-12 text-right">${percentage}%</span>
              </div>
            </td>
          </tr>
        `);
      });
    }
  }
}
