// Voting functionality module
let currentVoterId = null;
let currentVoterAvatar = null;
let votesCast = 0;

// Initialize user session on page load
function initUserSession() {
  const voterId = sessionStorage.getItem('voterId');
  const voterAvatar = sessionStorage.getItem('voterAvatar');
  
  if (voterId && voterAvatar) {
    currentVoterId = voterId;
    currentVoterAvatar = voterAvatar;
    
    // Show user avatar in nav and hide login link
    displayUserNav();
    
    // Show vote counter badge
    $('#voteCounterBadge').removeClass('hidden');
    
    // Load votes cast by this user (from localStorage)
    const userVotes = JSON.parse(localStorage.getItem(`votes_${voterId}`) || '[]');
    votesCast = userVotes.length;
    updateVoteCounter();
  }
}

// Display user info in navigation
function displayUserNav() {
  if (currentVoterAvatar) {
    // Hide login link
    $('#nav-login').parent().addClass('hidden');
    
    // Show user avatar section
    $('#userNavSection').removeClass('hidden');
    $('#userNavAvatar').attr('src', currentVoterAvatar);
  }
}

// Update vote counter display
function updateVoteCounter() {
  $('#voteCounter').text(votesCast);
}

// Cast vote function
function castVote(position_id, position_name, candidate_id, candidate_name, selectEl, voteBtn) {
  // Store vote in localStorage
  const userVotes = JSON.parse(localStorage.getItem(`votes_${currentVoterId}`) || '[]');
  
  // Check if already voted for this position
  if (userVotes.find(v => v.position_id === position_id)) {
    Toastify({
      text: '⚠️ You already voted for this position',
      duration: 3000,
      gravity: 'top',
      position: 'center',
      backgroundColor: '#f59e0b',
      stopOnFocus: true
    }).showToast();
    return;
  }
  
  // Add vote
  userVotes.push({
    voter_id: currentVoterId,
    position_id,
    candidate_id,
    candidate_name,
    timestamp: new Date().toISOString()
  });
  
  localStorage.setItem(`votes_${currentVoterId}`, JSON.stringify(userVotes));
  
  // Update global votes cast
  votesCast++;
  updateVoteCounter();
  
  // Disable select and button
  selectEl.prop('disabled', true);
  voteBtn.prop('disabled', true);
  voteBtn.addClass('opacity-50 cursor-not-allowed');
  
  // Show success toast with candidate name
  Toastify({
    text: `✓ You just voted for ${candidate_name}`,
    duration: 3000,
    gravity: 'top',
    position: 'center',
    backgroundColor: '#10b981',
    stopOnFocus: true
  }).showToast();
  
  // Log vote (in real implementation, this would send to Firebase)
  console.log('Vote cast:', {
    voter_id: currentVoterId,
    position_id,
    candidate_id,
    candidate_name,
    timestamp: new Date().toISOString()
  });
}

// Handle vote button click
function handleVoteClick(p, candidate_id, candidate_name, selectEl, voteBtn) {
  if (!candidate_id) {
    Toastify({
      text: '⚠️ Please select a candidate',
      duration: 3000,
      gravity: 'top',
      position: 'center',
      backgroundColor: '#f59e0b',
      stopOnFocus: true
    }).showToast();
    return;
  }

  if (!currentVoterId) {
    Toastify({
      text: '⚠️ Please login to vote',
      duration: 3000,
      gravity: 'top',
      position: 'center',
      backgroundColor: '#f59e0b',
      stopOnFocus: true
    }).showToast();
    return;
  }

  // Cast vote directly without confirmation modal
  castVote(p.id, p.name, candidate_id, candidate_name, selectEl, voteBtn);
}
