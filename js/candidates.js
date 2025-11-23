// Candidates loading module
let candidatesCache = null;
let allUsers = [];

// Load users for login
function loadUsers(callback) {
  const path = window.location.pathname.includes('/pages/') ? '../data/users.json' : 'data/users.json';
  $.get(path, function(data) {
    if (data.ok && data.users) {
      allUsers = data.users;
      if (callback) callback();
    }
  }).fail(function() {
    console.error('Failed to load users');
    Toastify({
      text: '✗ Failed to load voter list',
      duration: 3000,
      gravity: 'top',
      position: 'center',
      backgroundColor: '#ef4444',
      stopOnFocus: true
    }).showToast();
  });
}

// Initialize login on page load
$(function() {
  // Only run on login page (index.html)
  if ($('#loginForm').length) {
    loadUsers();
    
    // Update voter display when input changes
    $('#voterId').on('input', function() {
      const voterId = $(this).val().trim().toUpperCase();
      const user = allUsers.find(u => u.id === voterId);

      if (user) {
        $('#voterDisplay').removeClass('hidden');
        $('#voterIdDisplay').text(user.id);
        $('#voterAvatar').attr('src', user.avatar);
      } else {
        $('#voterDisplay').addClass('hidden');
      }
    });
    
    $('#loginForm').on('submit', function(e) {
      e.preventDefault();
      const voter_id = ($('#voterId').val() || '').trim().toUpperCase();
      
      if (!voter_id) {
        Toastify({
          text: '⚠️ Please enter your Voter ID',
          duration: 3000,
          gravity: 'top',
          position: 'center',
          backgroundColor: '#f59e0b',
          stopOnFocus: true
        }).showToast();
        return;
      }

      // Check if voter ID exists
      const user = allUsers.find(u => u.id === voter_id);
      if (!user) {
        Toastify({
          text: '✗ Voter ID not found. Please check and try again.',
          duration: 3000,
          gravity: 'top',
          position: 'center',
          backgroundColor: '#ef4444',
          stopOnFocus: true
        }).showToast();
        return;
      }

      // Show loading state
      const btn = $(this).find('button');
      btn.prop('disabled', true).html('⏳ Verifying...');

      // Simulate verification and redirect
      setTimeout(function() {
        Toastify({
          text: '✓ Login successful! Redirecting...',
          duration: 2000,
          gravity: 'top',
          position: 'center',
          backgroundColor: '#10b981',
          stopOnFocus: true
        }).showToast();
        
        // Store voter ID in session
        sessionStorage.setItem('voterId', voter_id);
        sessionStorage.setItem('voterAvatar', user.avatar);
        
        setTimeout(function() {
          window.location.href = 'pages/voting.html';
        }, 500);
      }, 500);
    });
  }
});

// Fetch and cache candidates data
function loadCandidates(callback) {
  if (candidatesCache) {
    callback(candidatesCache);
    return;
  }
  
  const path = window.location.pathname.includes('/pages/') ? '../data/candidates.json' : 'data/candidates.json';
  $.get(path, function(data) {
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
