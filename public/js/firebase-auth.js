/**
 * Firebase Authentication Module for RPM Web Monitoring
 * Supports Email/Password, Google Sign-In, and Demo/Offline Mode
 */

// Default Firebase Configuration (can be updated from UI Sistem tab or .env)
const defaultFirebaseConfig = {
    apiKey: "AIzaSyDummyKeyForRPMWebMonitoring2025",
    authDomain: "monitoring-rpm.firebaseapp.com",
    projectId: "monitoring-rpm",
    storageBucket: "monitoring-rpm.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456"
};

class RPMAuthService {
    constructor() {
        this.currentUser = null;
        this.isDemoMode = false;
        this.initFirebase();
        this.checkExistingSession();
    }

    initFirebase() {
        try {
            const savedConfig = localStorage.getItem('rpm_firebase_config');
            const config = savedConfig ? JSON.parse(savedConfig) : defaultFirebaseConfig;

            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(config);
                this.auth = firebase.auth();
                this.googleProvider = new firebase.auth.GoogleAuthProvider();

                this.auth.onAuthStateChanged((user) => {
                    if (user && !this.isDemoMode) {
                        this.setUser({
                            name: user.displayName || user.email.split('@')[0],
                            email: user.email,
                            photoURL: user.photoURL || null,
                            source: 'Firebase'
                        });
                    } else if (!this.isDemoMode) {
                        this.clearUser();
                    }
                });
            }
        } catch (err) {
            console.warn("Firebase Auth initialized in offline/demo fallback mode:", err);
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

    // Login with Email & Password
    async loginWithEmail(email, password) {
        if (this.auth && this.auth.app.options.apiKey !== defaultFirebaseConfig.apiKey) {
            try {
                const res = await this.auth.signInWithEmailAndPassword(email, password);
                return { success: true, user: res.user };
            } catch (err) {
                return { success: false, message: err.message };
            }
        } else {
            // Local dev fallback
            if (password.length >= 4) {
                this.setUser({
                    name: email.split('@')[0],
                    email: email,
                    photoURL: null,
                    source: 'Demo'
                });
                return { success: true };
            } else {
                return { success: false, message: 'Password minimal 4 karakter.' };
            }
        }
    }

    // Sign up with Email & Password
    async signUpWithEmail(name, email, password) {
        if (this.auth && this.auth.app.options.apiKey !== defaultFirebaseConfig.apiKey) {
            try {
                const res = await this.auth.createUserWithEmailAndPassword(email, password);
                await res.user.updateProfile({ displayName: name });
                return { success: true, user: res.user };
            } catch (err) {
                return { success: false, message: err.message };
            }
        } else {
            this.setUser({
                name: name || email.split('@')[0],
                email: email,
                photoURL: null,
                source: 'Demo'
            });
            return { success: true };
        }
    }

    // Sign in with Google
    async signInWithGoogle() {
        if (this.auth && this.auth.app.options.apiKey !== defaultFirebaseConfig.apiKey) {
            try {
                const res = await this.auth.signInWithPopup(this.googleProvider);
                return { success: true, user: res.user };
            } catch (err) {
                return { success: false, message: err.message };
            }
        } else {
            // Mock Google Login
            this.setUser({
                name: 'Operator RPM (Google)',
                email: 'operator.rpm@gmail.com',
                photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                source: 'Demo'
            });
            return { success: true };
        }
    }

    // Quick demo login
    loginAsDemo() {
        this.isDemoMode = true;
        this.setUser({
            name: 'Senior Operator CAS',
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
            } catch (e) {}
        }
        this.clearUser();
        if (typeof showToast === 'function') {
            showToast('Anda telah logout.', 'info');
        }
    }

    updateUI() {
        const authModal = document.getElementById('auth-modal');
        const userMenu = document.getElementById('user-profile-menu');
        const userEmailEl = document.getElementById('user-email-display');
        const userNameEl = document.getElementById('user-name-display');

        if (this.currentUser) {
            if (authModal) authModal.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (userEmailEl) userEmailEl.textContent = this.currentUser.email;
            if (userNameEl) userNameEl.textContent = this.currentUser.name;
        } else {
            if (authModal) authModal.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    }
}

// Global instance
window.rpmAuth = new RPMAuthService();
