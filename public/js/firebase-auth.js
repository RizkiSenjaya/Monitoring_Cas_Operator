/**
 * Firebase Authentication Module for RPM Web Monitoring
 * Integrated with project: monitoring-rpm-12
 * Supports Google Popup Sign-In, Email/Password Registration & Login
 */

// Active Firebase Configuration
const defaultFirebaseConfig = {
    apiKey: "AIzaSyC3UsFQglXETu9J_uHXhkD7yk6GP-2gzL4",
    authDomain: "monitoring-rpm-12.firebaseapp.com",
    projectId: "monitoring-rpm-12",
    storageBucket: "monitoring-rpm-12.firebasestorage.app",
    messagingSenderId: "1044642651459",
    appId: "1:1044642651459:web:ec0f8b617cdb1f028463f6",
    measurementId: "G-4B8LDSJ60K"
};

class RPMAuthService {
    constructor() {
        this.currentUser = null;
        this.isDemoMode = false;
        this.auth = null;
        this.googleProvider = null;
        this.initFirebase();
        this.checkExistingSession();
    }

    initFirebase() {
        try {
            const savedConfig = localStorage.getItem('rpm_firebase_config');
            const config = savedConfig ? JSON.parse(savedConfig) : defaultFirebaseConfig;

            if (typeof firebase !== 'undefined') {
                if (!firebase.apps.length) {
                    firebase.initializeApp(config);
                }
                this.auth = firebase.auth();
                this.googleProvider = new firebase.auth.GoogleAuthProvider();
                this.googleProvider.setCustomParameters({ prompt: 'select_account' });

                this.auth.onAuthStateChanged((user) => {
                    if (user && !this.isDemoMode) {
                        this.setUser({
                            uid: user.uid,
                            name: user.displayName || user.email.split('@')[0],
                            email: user.email,
                            photoURL: user.photoURL || null,
                            source: user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'Firebase'
                        });
                    } else if (!this.isDemoMode && !localStorage.getItem('rpm_auth_user')) {
                        this.clearUser();
                    }
                });
            }
        } catch (err) {
            console.error("Gagal menginisialisasi Firebase Auth:", err);
        }
    }

    checkExistingSession() {
        const session = localStorage.getItem('rpm_auth_user');
        if (session) {
            try {
                this.currentUser = JSON.parse(session);
                this.isDemoMode = (this.currentUser.source === 'Demo');
                this.updateUI();
            } catch (e) {
                this.clearUser();
            }
        } else {
            this.updateUI();
        }
    }

    setUser(userData) {
        this.currentUser = userData;
        localStorage.setItem('rpm_auth_user', JSON.stringify(userData));
        this.updateUI();
        if (typeof showToast === 'function') {
            showToast(`Selamat datang, ${userData.name}!`, 'success');
        }
    }

    clearUser() {
        this.currentUser = null;
        this.isDemoMode = false;
        localStorage.removeItem('rpm_auth_user');
        this.updateUI();
    }

    // Translate Firebase Auth error codes to friendly Indonesian messages
    getErrorMessage(err) {
        if (!err || !err.code) return err?.message || 'Terjadi kesalahan autentikasi.';
        switch (err.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
                return 'Email atau kata sandi tidak cocok. Silakan periksa kembali.';
            case 'auth/user-not-found':
                return 'Akun belum terdaftar. Silakan pilih tab Daftar (Sign Up).';
            case 'auth/email-already-in-use':
                return 'Email ini sudah terdaftar. Silakan langsung masuk (Login).';
            case 'auth/weak-password':
                return 'Kata sandi terlalu lemah. Minimal 6 karakter.';
            case 'auth/invalid-email':
                return 'Format alamat email tidak valid.';
            case 'auth/popup-closed-by-user':
                return 'Pop-up Google Sign-In ditutup sebelum proses masuk selesai.';
            case 'auth/popup-blocked':
                return 'Jendela pop-up diblokir oleh browser. Izinkan pop-up untuk situs ini.';
            case 'auth/unauthorized-domain':
                return 'Domain ini belum diizinkan di Firebase Console. Tambahkan domain (localhost / 127.0.0.1) pada Firebase Console > Authentication > Settings > Authorized Domains.';
            case 'auth/network-request-failed':
                return 'Koneksi internet bermasalah. Periksa jaringan Anda.';
            case 'auth/too-many-requests':
                return 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa menit.';
            default:
                return err.message || 'Terjadi kesalahan pada Firebase Auth.';
        }
    }

    // Login with Email & Password
    async loginWithEmail(email, password) {
        if (!this.auth) {
            return { success: false, message: 'Firebase Auth belum siap.' };
        }
        try {
            const res = await this.auth.signInWithEmailAndPassword(email, password);
            this.isDemoMode = false;
            return { success: true, user: res.user };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, message: this.getErrorMessage(err) };
        }
    }

    // Sign up / Register with Email & Password
    async signUpWithEmail(name, email, password) {
        if (!this.auth) {
            return { success: false, message: 'Firebase Auth belum siap.' };
        }
        try {
            const res = await this.auth.createUserWithEmailAndPassword(email, password);
            if (name && res.user) {
                await res.user.updateProfile({ displayName: name });
            }
            this.isDemoMode = false;
            return { success: true, user: res.user };
        } catch (err) {
            console.error('Sign-up error:', err);
            return { success: false, message: this.getErrorMessage(err) };
        }
    }

    // Sign in with Google (Popup)
    async signInWithGoogle() {
        if (!this.auth) {
            return { success: false, message: 'Firebase Auth belum siap.' };
        }
        try {
            const res = await this.auth.signInWithPopup(this.googleProvider);
            this.isDemoMode = false;
            return { success: true, user: res.user };
        } catch (err) {
            console.error('Google sign-in error:', err);
            return { success: false, message: this.getErrorMessage(err) };
        }
    }

    // Secondary demo access fallback (for local tests without internet)
    loginAsDemo() {
        this.isDemoMode = true;
        this.setUser({
            name: 'Operator CAS (Demo)',
            email: 'operator@rpm.internal',
            photoURL: null,
            source: 'Demo'
        });
    }

    // Logout
    async logout() {
        if (this.auth) {
            try {
                await this.auth.signOut();
            } catch (e) {
                console.warn('Sign out error:', e);
            }
        }
        this.clearUser();
        if (typeof showToast === 'function') {
            showToast('Anda telah keluar dari sesi.', 'info');
        }
    }

    updateUI() {
        const authModal = document.getElementById('auth-modal');
        const userMenu = document.getElementById('user-profile-menu');
        const userEmailEl = document.getElementById('user-email-display');
        const userNameEl = document.getElementById('user-name-display');
        const userAvatarEl = document.getElementById('user-avatar-display');

        if (this.currentUser) {
            if (authModal) authModal.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (userEmailEl) userEmailEl.textContent = this.currentUser.email;
            if (userNameEl) userNameEl.textContent = this.currentUser.name;
            if (userAvatarEl) {
                if (this.currentUser.photoURL) {
                    userAvatarEl.innerHTML = `<img src="${this.currentUser.photoURL}" class="w-full h-full object-cover rounded-full" alt="Avatar">`;
                } else {
                    const initials = (this.currentUser.name || 'OP').substring(0, 2).toUpperCase();
                    userAvatarEl.innerHTML = `<span>${initials}</span>`;
                }
            }
        } else {
            if (authModal) authModal.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    }
}

// Global instance
window.rpmAuth = new RPMAuthService();

