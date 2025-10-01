//
// ===================================
//  STEP 1: FIREBASE CONFIGURATION
// ===================================
//
// WARNING: The keys below are exposed. Please generate new ones in your Firebase console.
alert("✅ SUCCESS: The NEWEST app.js file is running!");

// ... the rest of your firebaseConfig and code goes below

const firebaseConfig = {
    apiKey: "AIzaSyDIXwI85CH-uXrsPmXTCsX2cEzKPtPxcP8",
    authDomain: "employeeattendanceapp-387e2.firebaseapp.com",
    projectId: "employeeattendanceapp-387e2",
    storageBucket: "employeeattendanceapp-387e2.appspot.com",
    messagingSenderId: "1023846201615",
    appId: "1:1023846201615:web:040da8523772ac8275267a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

//
// ========================================
//  STEP 2: ELEMENT REFERENCES & CONSTANTS
// ========================================
//
// Screens
const authScreen = document.getElementById('auth-screen');
const adminDashboard = document.getElementById('admin-dashboard');
const employeeDashboard = document.getElementById('employee-dashboard');

// Auth View Toggle
const showLoginLink = document.getElementById('show-login');
const showSignupLink = document.getElementById('show-signup');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');

// Login Form
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');

// Signup Form
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupBtn = document.getElementById('signup-btn');

// Admin Dashboard
const companyLatInput = document.getElementById('company-lat');
const companyLonInput = document.getElementById('company-lon');
const saveLocationBtn = document.getElementById('save-location-btn');
const logoutBtnAdmin = document.getElementById('logout-btn-admin');

// Employee Dashboard
const employeeEmailSpan = document.getElementById('employee-email');
const registerFpBtn = document.getElementById('register-fp-btn');
const fpStatus = document.getElementById('fp-status');
const markAttendanceBtn = document.getElementById('mark-attendance-btn');
const attendanceStatus = document.getElementById('attendance-status');
const logoutBtnEmployee = document.getElementById('logout-btn-employee');

// Constants
const browser = window.SimpleWebAuthnBrowser;
const ADMIN_EMAIL = "admin@company.com"; // Change this to your admin email
const ALLOWED_RADIUS_METERS = 100;

//
// ========================================
//  STEP 3: UI & AUTHENTICATION LOGIC
// ========================================
//
function showScreen(screenElement) {
    authScreen.classList.remove('active');
    adminDashboard.classList.remove('active');
    employeeDashboard.classList.remove('active');
    screenElement.classList.add('active');
}

showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    signupView.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupView.style.display = 'none';
    loginView.style.display = 'block';
});

signupBtn.addEventListener('click', () => {
    const email = signupEmail.value;
    const password = signupPassword.value;
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            console.log('User signed up:', userCredential.user);
            alert('Signup successful! Please log in.');
        })
        .catch(error => alert(error.message));
});

loginBtn.addEventListener('click', () => {
    const email = loginEmail.value;
    const password = loginPassword.value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
});

logoutBtnAdmin.addEventListener('click', () => auth.signOut());
logoutBtnEmployee.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(user => {
    if (user) {
        if (user.email === ADMIN_EMAIL) {
            showScreen(adminDashboard);
            loadCompanyLocation();
        } else {
            showScreen(employeeDashboard);
            employeeEmailSpan.textContent = user.email;
            checkFingerprintRegistration(user.uid);
        }
    } else {
        showScreen(authScreen);
    }
});

//
// ========================================
//  STEP 4: ADMIN DASHBOARD LOGIC
// ========================================
//
saveLocationBtn.addEventListener('click', () => {
    const lat = parseFloat(companyLatInput.value);
    const lon = parseFloat(companyLonInput.value);

    if (isNaN(lat) || isNaN(lon)) {
        return alert('Please enter valid coordinates.');
    }

    db.collection('company').doc('location').set({
            latitude: lat,
            longitude: lon
        })
        .then(() => alert('Location saved successfully!'))
        .catch(error => alert('Error saving location: ' + error.message));
});

async function loadCompanyLocation() {
    const doc = await db.collection('company').doc('location').get();
    if (doc.exists) {
        companyLatInput.value = doc.data().latitude;
        companyLonInput.value = doc.data().longitude;
    }
}

//
// ========================================
//  STEP 5: HELPER FUNCTION FOR WEBAUTHN
// ========================================
//
function bufferToBase64URL(buffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

//
// ========================================
//  STEP 6: EMPLOYEE FINGERPRINT (WEBAUTHN) LOGIC
// ========================================
//
registerFpBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    // The Relying Party ID (rpId) must be a hostname, not an IP address.
    const rpId = window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname;

    const challengeBuffer = new Uint8Array(32).map(() => Math.floor(Math.random() * 256));
    const challenge = bufferToBase64URL(challengeBuffer);

    const registrationOptions = {
        rp: {
            name: 'Employee Attendance App',
            id: rpId
        },
        user: {
            id: bufferToBase64URL(new TextEncoder().encode(user.uid)),
            name: user.email,
            displayName: user.email
        },
        challenge,
        pubKeyCredParams: [{
            alg: -7,
            type: 'public-key'
        }, {
            alg: -257,
            type: 'public-key'
        }, ],
        authenticatorSelection: {
            userVerification: 'required'
        },
        timeout: 60000,
        attestation: 'direct'
    };

    try {
        const registrationCredential = await browser.startRegistration(registrationOptions);

        await db.collection('users').doc(user.uid).set({
            fingerprintCredential: {
                id: registrationCredential.id,
            }
        }, {
            merge: true
        });

        fpStatus.textContent = 'Fingerprint registered successfully!';
        fpStatus.className = 'status-message success';
        registerFpBtn.disabled = true;
    } catch (error) {
        console.error(error);
        fpStatus.textContent = 'Registration failed. Check console for errors.';
        fpStatus.className = 'status-message error';
    }
});

async function checkFingerprintRegistration(uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data().fingerprintCredential) {
        fpStatus.textContent = 'Fingerprint is already registered.';
        fpStatus.className = 'status-message success';
        registerFpBtn.disabled = true;
    } else {
        fpStatus.textContent = 'Please register your fingerprint.';
        fpStatus.className = 'status-message';
        registerFpBtn.disabled = false;
    }
}

//
// ========================================
//  STEP 7: EMPLOYEE ATTENDANCE LOGIC
// ========================================
//
markAttendanceBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    attendanceStatus.textContent = 'Please verify with your fingerprint...';
    attendanceStatus.className = 'status-message';

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists || !userDoc.data().fingerprintCredential) {
            return alert('No fingerprint registered. Please register first.');
        }

        const credentialId = userDoc.data().fingerprintCredential.id;

        const challengeBuffer = new Uint8Array(32).map(() => Math.floor(Math.random() * 256));
        const challenge = bufferToBase64URL(challengeBuffer);

        const authenticationOptions = {
            challenge,
            allowCredentials: [{
                id: credentialId,
                type: 'public-key',
            }, ],
            userVerification: 'required',
        };

        await browser.startAuthentication(authenticationOptions);

        attendanceStatus.textContent = 'Fingerprint verified! Checking location...';
        attendanceStatus.className = 'status-message success';

        navigator.geolocation.getCurrentPosition(positionSuccess, positionError);

    } catch (error) {
        console.error(error);
        attendanceStatus.textContent = 'Fingerprint verification failed.';
        attendanceStatus.className = 'status-message error';
    }
});

async function positionSuccess(position) {
    const userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
    };

    const companyLocDoc = await db.collection('company').doc('location').get();
    if (!companyLocDoc.exists) {
        attendanceStatus.textContent = 'Company location not set by admin.';
        attendanceStatus.className = 'status-message error';
        return;
    }
    const companyCoords = companyLocDoc.data();

    const distance = haversineDistance(userCoords, companyCoords);

    if (distance <= ALLOWED_RADIUS_METERS) {
        attendanceStatus.textContent = `You are ${Math.round(distance)}m away. Attendance marked!`;
        attendanceStatus.className = 'status-message success';

        const user = auth.currentUser;
        await db.collection('attendance').add({
            userId: user.uid,
            email: user.email,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            location: new firebase.firestore.GeoPoint(userCoords.latitude, userCoords.longitude)
        });
        markAttendanceBtn.disabled = true;
        setTimeout(() => {
            attendanceStatus.textContent = 'Your attendance for today is marked.';
        }, 5000);

    } else {
        attendanceStatus.textContent = `Failed: You are ${Math.round(distance)}m away from the office. You must be within ${ALLOWED_RADIUS_METERS}m.`;
        attendanceStatus.className = 'status-message error';
    }
}

function positionError(error) {
    attendanceStatus.textContent = `Error getting location: ${error.message}`;
    attendanceStatus.className = 'status-message error';
}

function haversineDistance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }
    const R = 6371e3;
    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const lat1 = toRad(coords1.latitude);
    const lat2 = toRad(coords2.latitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}