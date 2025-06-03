import { isLoggedIn, getUser } from './user-cache.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js';

if (isLoggedIn()) {
  const { auth, profile } = getUser();
  // Do something with user data
} else {
  // Redirect to login or show guest UI
}

if (!isLoggedIn() && !window.location.pathname.includes('/auth/login')) {
  // use relative path so it works when served from /public/
  window.location.href = 'auth/login.html';
}

// Blog logic removed
