/* ================================================================
   AUTH.JS — Authentification Supabase (connexion / inscription)
================================================================ */

        /* ── AUTHENTIFICATION SUPABASE ──────────────────────────────
           Vrai systeme de connexion email + mot de passe.
           Quand l'admin retire quelqu'un (actif=false), cette personne
           est immediatement deconnectee et ne peut plus se reconnecter
           meme avec le bon mot de passe.
        ──────────────────────────────────────────────────────── */
        var sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,      /* Garde la session apres fermeture de l'app */
                autoRefreshToken: true,    /* Renouvelle le token automatiquement */
                storageKey: 'gtm-coloc-auth'
            }
        });
        var currentProfile = null; /* Profil Supabase (ligne scores) de la personne connectee */

        function switchAuthTab(tab) {
            var loginBtn = document.getElementById('tab-login-btn');
            var signupBtn = document.getElementById('tab-signup-btn');
            var loginForm = document.getElementById('login-form');
            var signupForm = document.getElementById('signup-form');
            if (tab === 'login') {
                loginBtn.className = 'flex-1 py-2 rounded-xl text-xs font-black bg-blue-600 text-white';
                signupBtn.className = 'flex-1 py-2 rounded-xl text-xs font-black text-slate-500';
                loginForm.classList.remove('hidden');
                signupForm.classList.add('hidden');
            } else {
                signupBtn.className = 'flex-1 py-2 rounded-xl text-xs font-black bg-green-600 text-white';
                loginBtn.className = 'flex-1 py-2 rounded-xl text-xs font-black text-slate-500';
                signupForm.classList.remove('hidden');
                loginForm.classList.add('hidden');
            }
        }

        function signUpUser() {
            var nom = document.getElementById('signup-name').value.trim().toUpperCase();
            var email = document.getElementById('signup-email').value.trim();
            var password = document.getElementById('signup-password').value;
            if (!nom || !email || !password) { showToast('Remplis tous les champs !'); return; }
            if (password.length < 6) { showToast('Mot de passe trop court (6 caracteres min.) !'); return; }

            sb.auth.signUp({ email: email, password: password }).then(function(res) {
                if (res.error) { showToast(res.error.message); return; }
                var userId = res.data.user.id;
                /* Cherche si ce prenom existe deja sans compte lie (ancien systeme) */
                dbGet('scores', '*', ['name=eq.' + encodeURIComponent(nom)]).then(function(rows) {
                    var existing = rows.find(function(r) { return !r.user_id; });
                    var afterDone = function() {
                        showToast('Compte cree ! Tu peux maintenant te connecter.');
                        switchAuthTab('login');
                        document.getElementById('login-email').value = email;
                    };
                    if (existing) {
                        dbUpdate('scores', { user_id: userId, email: email, actif: true }, ['id=eq.' + existing.id]).then(afterDone);
                    } else {
                        dbInsert('scores', {
                            name: nom, points: 0, last_week_validated: 0,
                            tache_en_retard: null, retard_valide: false,
                            user_id: userId, email: email, actif: true
                        }).then(afterDone);
                    }
                });
            });
        }

        function loginUser() {
            var email = document.getElementById('login-email').value.trim();
            var password = document.getElementById('login-password').value;
            if (!email || !password) { showToast('Remplis email et mot de passe !'); return; }

            sb.auth.signInWithPassword({ email: email, password: password }).then(function(res) {
                if (res.error) { showToast('Email ou mot de passe incorrect.'); return; }
                applyLoggedInProfile(res.data.user.id, true);
            });
        }

        /* Verifie systematiquement que le profil est toujours actif.
           Appele au demarrage ET periodiquement pour couper l'acces
           en temps reel si l'admin retire la personne. */
        function checkSession() {
            sb.auth.getSession().then(function(res) {
                var session = res.data.session;
                if (!session) {
                    document.getElementById('access-revoked-screen').classList.add('hidden');
                    document.getElementById('identity-modal').classList.remove('hidden');
                    return;
                }
                applyLoggedInProfile(session.user.id, false);
            });
        }

        function applyLoggedInProfile(userId, justLoggedIn) {
            dbGet('scores', '*', ['user_id=eq.' + userId]).then(function(rows) {
                var profile = rows[0];
                if (!profile || profile.actif === false) {
                    /* Compte desactive ou supprime -> deconnexion forcee */
                    sb.auth.signOut();
                    localStorage.removeItem('gtm-coloc-identity');
                    showAccessRevoked(profile ? profile.name : 'Ce compte');
                    return;
                }
                currentProfile = profile;
                localStorage.setItem('gtm-coloc-identity', profile.name);
                document.getElementById('access-revoked-screen').classList.add('hidden');
                document.getElementById('identity-modal').classList.add('hidden');
                updateHeaderIdentity(profile.name);
                updateNotifStatusUI();
                if (justLoggedIn) {
                    var channel = getNtfyChannel(profile.name);
                    document.getElementById('ntfy-channel-display').textContent = channel;
                    document.getElementById('identity-modal').classList.remove('hidden');
                    document.getElementById('login-form').classList.add('hidden');
                    document.getElementById('signup-form').classList.add('hidden');
                    document.getElementById('ntfy-instruction').classList.remove('hidden');
                    document.getElementById('ntfy-confirm-btn').classList.remove('hidden');
                }
            });
        }

        function showAccessRevoked(nom) {
            document.getElementById('identity-modal').classList.add('hidden');
            document.getElementById('revoked-name-display').textContent = nom;
            document.getElementById('access-revoked-screen').classList.remove('hidden');
        }

        function confirmIdentity() {
            document.getElementById('identity-modal').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('ntfy-instruction').classList.add('hidden');
            document.getElementById('ntfy-confirm-btn').classList.add('hidden');
            showToast('Bienvenue ' + (currentProfile ? currentProfile.name : '') + ' !');
        }

        function updateHeaderIdentity(nom) {
            var wi=document.getElementById('week-info');
            if(wi) wi.innerText='Semaine n°'+getWeekNumber()+' — '+nom;
        }

        function logoutUser() {
            sb.auth.signOut().then(function() {
                localStorage.removeItem('gtm-coloc-identity');
                currentProfile = null;
                location.reload();
            });
        }

        function confirmLogout() {
            var nom = currentProfile ? currentProfile.name : (localStorage.getItem('gtm-coloc-identity') || '');
            if (!confirm('Se deconnecter' + (nom ? ' de ' + nom : '') + ' ?')) return;
            logoutUser();
        }

