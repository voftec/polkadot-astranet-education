import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js';
import { getDatabase, ref as rtdbRef, get, set } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-database.js';
import firebaseConfig from '../Firebase/firebase-config.js';

let app;
try {
  app = getApp();
} catch {
  app = initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const rtdb = getDatabase(app);

const loginBtn = document.getElementById('loginNavBtn');

function progressRef(uid) {
  return rtdbRef(rtdb, `users/${uid}/polkadot-astranet-education/progress`);
}

async function fetchProgress(uid) {
  const ref = progressRef(uid);
  const snap = await get(ref);
  if (snap.exists()) {
    return snap.val();
  }
  await set(ref, 0);
  return 0;
}

async function saveProgress(uid, progress) {
  await set(progressRef(uid), progress);
}

// Update UI when progress is loaded
function updateProgressUI(value) {
  const circle = document.getElementById('learningProgressCircle');
  if (!circle) return;
  circle.setAttribute('data-progress', value);
  const text = circle.querySelector('.progress-text');
  if (text) text.textContent = `${value}%`;
}

// Listen for login/logout events
document.addEventListener('app:userLoggedIn', async (e) => {
  const uid = e.detail.user.uid;
  const progress = await fetchProgress(uid);
  updateProgressUI(progress);
  document.dispatchEvent(new CustomEvent('progress:loaded', { detail: progress }));
  if (loginBtn) {
    loginBtn.textContent = 'Logout';
    loginBtn.removeAttribute('href');
    loginBtn.addEventListener('click', handleLogoutClick);
  }
});

document.addEventListener('app:userLoggedOut', () => {
  updateProgressUI(0);
  if (loginBtn) {
    loginBtn.textContent = 'Login';
    loginBtn.setAttribute('href', 'auth/login.html');
    loginBtn.removeEventListener('click', handleLogoutClick);
  }
});

// Save progress events from app.js
document.addEventListener('progress:save', async (e) => {
  const user = auth.currentUser;
  if (user) {
    await saveProgress(user.uid, e.detail);
  }
});

function handleLogoutClick(e) {
  e.preventDefault();
  document.dispatchEvent(new CustomEvent('app:requestLogout'));
}
