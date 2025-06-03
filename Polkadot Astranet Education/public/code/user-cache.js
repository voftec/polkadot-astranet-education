import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js';

let _authUser = null;
let _profile = null;

export function setUser(authData, profileData) {
  _authUser = authData;
  _profile = profileData;
  const auth = getAuth();
}

export function clearUser() {
  _authUser = null;
  _profile = null;
  console.log('[userSession] Cleared user cache');
}

export function getUser() {
  return { auth: _authUser, profile: _profile };
}

export function getAuthUser() {
  return _authUser;
}

export function getProfile() {
  return _profile;
}

export function updateProfile(updates) {
  if (!_profile) {
    console.warn('[userSession] Cannot update profile cache — no profile set');
    return;
  }
  _profile = { ..._profile, ...updates };
  console.log('[userSession] Updated cached profile:', _profile);
}

export function isLoggedIn() {
  return !!_authUser;
}

export function hasCompletedFtue() {
  return !!_profile?.ftue;
}

export function isAdmin() {
  return _profile?.isAdmin === true || _profile?.role === 'admin';
}
