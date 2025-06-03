import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-auth.js';
import {
  getDatabase,
  ref as rtdbRef,
  get,
  set,
  update
} from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-database.js';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/9.6.7/firebase-storage.js';
import firebaseConfig from '../Firebase/firebase-config.js';
import { setUser, clearUser, updateProfile } from './user-cache.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

let currentAuthUser = null;
let loginRedirectTriggered = false;

onAuthStateChanged(auth, async (user) => {
  currentAuthUser = user;
  if (user) {
    if (user.providerData.some(p => p.providerId === 'password') && !user.emailVerified) {
      setUser({ uid: user.uid, email: user.email, emailVerified: false }, null);
      document.dispatchEvent(new CustomEvent('app:userLoggedIn', {
        detail: { user: { uid: user.uid, email: user.email, emailVerified: false }, profile: null, needsVerification: true }
      }));
      return;
    }

    try {
      const userProfilePath = `users/${user.uid}`;
      const adminStatusPath = `admins/${user.uid}`;

      const [profileSnapshot, adminStatusSnapshot] = await Promise.all([
        get(rtdbRef(rtdb, userProfilePath)),
        get(rtdbRef(rtdb, adminStatusPath))
    ]);
    

      let profileData;

      if (profileSnapshot.exists()) {
        profileData = profileSnapshot.val();
      } else {
        profileData = { name: "default", lastName: "default", ftue: false, profilePictureURL: "" };
        await set(rtdbRef(rtdb, userProfilePath), profileData);
      }

      profileData.isAdmin = adminStatusSnapshot.exists() && adminStatusSnapshot.val() === 'a';

      setUser({ uid: user.uid, email: user.email, emailVerified: user.emailVerified }, profileData);
      
      document.dispatchEvent(new CustomEvent('app:userLoggedIn', {
        detail: {
          user: { uid: user.uid, email: user.email, emailVerified: user.emailVerified },
          profile: profileData
        }
      }));      

    } catch (error) {
      console.error("Error in onAuthStateChanged (fetching profile/admin status):", error);
      clearUser();
      document.dispatchEvent(new CustomEvent('app:userLoggedIn', {
        detail: {
          user: { uid: user.uid, email: user.email, emailVerified: user.emailVerified },
          profile: null,
          error: "Failed to load user profile"
        }
      }));
    }
  } else {
    clearUser();
    document.dispatchEvent(new CustomEvent('app:userLoggedOut'));    
  }
});

async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (userCredential.user.providerData.some(p => p.providerId === 'password') && !userCredential.user.emailVerified) {
      return { success: false, code: 'auth/email-not-verified', message: 'Verifica tu correo antes de continuar.' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, code: error.code, message: error.message };
  }
}

async function signupUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const defaultProfile = {
      name: "default",
      lastName: "default",
      ftue: false,
      profilePictureURL: ""
    };
    await set(rtdbRef(rtdb, `users/${user.uid}`), defaultProfile);
    await sendEmailVerification(user);
    return { success: true, message: 'Registro exitoso. Por favor verifica tu correo.' };
  } catch (error) {
    return { success: false, code: error.code, message: error.message };
  }
}

async function logoutUser() {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function updateUserProfileDetails(uid, profileUpdateData, profilePicFile) {
  if (!uid) return { success: false, message: "User ID is required for profile update." };

  let updatesToUserProfile = { ...profileUpdateData };
  if (profileUpdateData.name !== undefined || profileUpdateData.lastName !== undefined) {
    updatesToUserProfile.ftue = true;
  }

  try {
    const userProfileRef = rtdbRef(rtdb, `users/${uid}`);
    const adminStatusRef = rtdbRef(rtdb, `admins/${uid}`);

    if (profilePicFile) {
      const picStoragePath = `profile_pictures/${uid}/${profilePicFile.name}`;
      const picStorageRefInstance = storageRef(storage, picStoragePath);
      await uploadBytes(picStorageRefInstance, profilePicFile);
      updatesToUserProfile.profilePictureURL = await getDownloadURL(picStorageRefInstance);
    } else if (profileUpdateData.profilePictureURL !== undefined) {
      updatesToUserProfile.profilePictureURL = profileUpdateData.profilePictureURL;
    }

    await update(userProfileRef, updatesToUserProfile);

    const [updatedProfileSnapshot, adminStatusSnapshot] = await Promise.all([
        get(userProfileRef),
        get(adminStatusRef)
    ]);

    if (updatedProfileSnapshot.exists()) {
      const newProfile = updatedProfileSnapshot.val();
      newProfile.isAdmin = (adminStatusSnapshot.exists() && adminStatusSnapshot.val() === 'a');

      updateProfile(newProfile);
      document.dispatchEvent(new CustomEvent('app:profileUpdated', {
        detail: { profile: newProfile }
      }));

      return { success: true, profile: newProfile };
    } else {
      throw new Error("Updated profile node does not exist after update.");
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
}

document.addEventListener('app:requestProfileUpdate', async (event) => {
  const { uid, data, file } = event.detail;
  if (uid) {
    await updateUserProfileDetails(uid, data, file);
  } else {
    console.error("app:requestProfileUpdate event is missing UID.");
  }
});

document.addEventListener('app:requestLogout', async () => {
  await logoutUser();
});

window.authService = {
  loginUser,
  signupUser,
  logoutUser,
  updateUserProfileDetails
};

function initializeLoginUI() {
    const loginWidget = document.getElementById('loginWidget');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const signInButton = document.getElementById('signInButton');
    const showSignUpLink = document.getElementById('showSignUp');
    const loginPasswordToggle = loginWidget?.querySelector('.toggle-password');
    const loginEyeImg = document.getElementById('loginEyeImg');

    const signUpWidget = document.getElementById('signUpWidget');
    const signUpEmailInput = document.getElementById('signUpEmail');
    const signUpPasswordInput = document.getElementById('signUpPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const signUpButton = document.getElementById('signUpButton');
    const showLoginLink = document.getElementById('showLogin');
    const signUpPasswordToggle = signUpWidget?.querySelector('.toggle-password');
    const signUpEyeImg = document.getElementById('signUpEyeImg');

    if (!loginWidget && !signUpWidget) {
        return;
    }
    
    const eyeIconPath = '../assets/png/eye.png';
    const eyeSlashIconPath = '../assets/png/eye-slash.png';

    function togglePasswordVisibility(passwordInput, eyeImg) {
        if (!passwordInput || !eyeImg) return;
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeImg.src = eyeSlashIconPath;
        } else {
            passwordInput.type = 'password';
            eyeImg.src = eyeIconPath;
        }
    }

    if (showSignUpLink) {
        showSignUpLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginWidget && signUpWidget) {
                loginWidget.classList.add('hidden');
                signUpWidget.classList.remove('hidden');
            }
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (signUpWidget && loginWidget) {
                signUpWidget.classList.add('hidden');
                loginWidget.classList.remove('hidden');
            }
        });
    }

    if (loginPasswordToggle) {
        loginPasswordToggle.addEventListener('click', () => {
            togglePasswordVisibility(loginPasswordInput, loginEyeImg);
        });
    }

    if (signUpPasswordToggle) {
        signUpPasswordToggle.addEventListener('click', () => {
            togglePasswordVisibility(signUpPasswordInput, signUpEyeImg);
        });
    }
    
    if (signInButton) {
        signInButton.addEventListener('click', async () => {
            if (!loginEmailInput || !loginPasswordInput) return;
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value;

            if (!email || !password) {
                popupNotifier.error('Por favor ingresa correo y contraseña.', 'Credenciales faltantes');
                return;
            }
            signInButton.disabled = true;
            signInButton.textContent = 'Iniciando sesión...';
            const result = await loginUser(email, password);
            if (!result.success) {
                popupNotifier.error('Autenticación fallida: correo o contraseña incorrectos.', 'Inicio de sesión fallido');
            }
            signInButton.disabled = false;
            signInButton.textContent = 'Ingresar';
        });
    }

    if (signUpButton) {
        signUpButton.addEventListener('click', async () => {
            if(!signUpEmailInput || !signUpPasswordInput || !confirmPasswordInput) return;
            const email = signUpEmailInput.value.trim();
            const password = signUpPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!email || !password || !confirmPassword) {
                popupNotifier.error('Por favor completa todos los campos para registrarte.', 'Campos faltantes');
                return;
            }
            if (password.length < 6) {
                popupNotifier.error('La contraseña debe tener al menos 6 caracteres.', 'Contraseña débil');
                return;
            }
            if (password !== confirmPassword) {
                popupNotifier.error('Las contraseñas no coinciden.', 'Contraseñas distintas');
                return;
            }
            signUpButton.disabled = true;
            signUpButton.textContent = 'Registrando...';
            const result = await signupUser(email, password);
            if (result.success) {
                popupNotifier.success('Registro exitoso. Verifica tu correo.', 'Registro exitoso');
                if (signUpWidget && loginWidget) {
                    signUpWidget.classList.add('hidden');
                    loginWidget.classList.remove('hidden');
                }
                signUpEmailInput.value = '';
                signUpPasswordInput.value = '';
                confirmPasswordInput.value = '';
            } else {
                popupNotifier.error(result.message || result.code, 'Error de registro');
            }
            signUpButton.disabled = false;
            signUpButton.textContent = 'Registrarse';
        });
    }
}

document.addEventListener('app:userLoggedIn', (event) => {
    const { user, profile, needsVerification, error } = event.detail;
    if (error) {
        console.error("Login/Profile fetch error reported to UI:", error);
    } else if (needsVerification) {
        popupNotifier.info('Revisa tu correo para verificar tu cuenta antes de iniciar sesión.', 'Verificar correo');
    } else if (user && user.emailVerified && window.location.pathname.includes('/auth/login') && !loginRedirectTriggered) {
        popupNotifier.success('¡Inicio de sesión exitoso! Redirigiendo...', 'Inicio exitoso');
        loginRedirectTriggered = true;
        window.location.href = '/public/index.html';
    }
});

document.addEventListener('app:userLoggedOut', () => {
    const referrer = document.referrer;
    const refUrl = referrer ? new URL(referrer) : null;
    const sameOrigin = refUrl && refUrl.origin === window.location.origin;
    const target = sameOrigin ? refUrl.pathname + refUrl.search + refUrl.hash : '/public/index.html';
    window.location.href = target;
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoginUI);
} else {
    initializeLoginUI();
}
