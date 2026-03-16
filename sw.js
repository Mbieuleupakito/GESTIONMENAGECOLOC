/* ================================================================
   SERVICE WORKER — Gestion Appart 48
   ================================================================
   CE QU'IL FAIT :
   • Dimanche 15h, 20h, 23h30 → notification d'alerte avec son
   • Dimanche 23h59 → malus automatique -2pts dans Supabase
   • À chaque validation → notification "X a validé sa tâche ✅"
================================================================ */

const CACHE_NAME = 'gestion-appart-48-v4';
const SUPABASE_URL = 'https://avpxzwjxmytdcmlxtixh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CoTpQtG8306po9DCFDRyrg_4-nC16vM';
const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
};

/* ── CYCLE DE VIE ──────────────────────────────────────────────── */
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()); });

/* ── MESSAGES DEPUIS L'APP ─────────────────────────────────────── */
self.addEventListener('message', function(event) {
    if (!event.data) return;

    /* Démarre la boucle de vérification dimanche */
    if (event.data.type === 'SCHEDULE_CHECKS') {
        startCheckLoop();
    }

    /* Notification de validation envoyée par l'app */
    if (event.data.type === 'VALIDATION_NOTIF') {
        sendValidationNotif(event.data.nom, event.data.mission);
    }

    /* Test admin : déclenche une alarme immédiate */
    if (event.data.type === 'TEST_ALARM') {
        sendAlarmNotif('🚨 TEST ALARME — Admin', 'Ceci est un test de l\'alarme du dimanche.', 'test');
    }

    /* Test admin : simule une notification de validation */
    if (event.data.type === 'TEST_VALIDATION') {
        sendValidationNotif(event.data.nom || 'PAKITO', event.data.mission || '🧹 Cuisine + Salon');
    }
});

/* ── BOUCLE VÉRIFICATION DIMANCHE ──────────────────────────────── */
function startCheckLoop() {
    checkAndAct();
    setInterval(checkAndAct, 60 * 1000);
}

function checkAndAct() {
    var now    = new Date();
    var day    = now.getDay();    // 0 = dimanche
    var hour   = now.getHours();
    var minute = now.getMinutes();

    if (day !== 0) return;

    var isAlert1    = hour === 15 && minute === 0;
    var isAlert2    = hour === 20 && minute === 0;
    var isAlert3    = hour === 23 && minute === 30;
    var isMalusTime = hour === 23 && minute === 59;

    if (isAlert1 || isAlert2 || isAlert3) handleAlert(isAlert1, isAlert2, isAlert3, now);
    if (isMalusTime) handleAutoMalus(now);
}

/* ── ALERTES DIMANCHE AVEC SON D'ALARME ────────────────────────── */
function handleAlert(isAlert1, isAlert2, isAlert3, now) {
    var alertKey = 'alert_' + now.toISOString().slice(0, 15);

    caches.open(CACHE_NAME).then(function(cache) {
        cache.match(alertKey).then(function(already) {
            if (already) return;
            cache.put(alertKey, new Response('sent'));

            getUnvalidatedColocs().then(function(unvalidated) {
                if (unvalidated.length === 0) return;

                var title, body;
                if (isAlert1) {
                    title = '⚠️ Rappel 15h — Mission non faite !';
                    body  = unvalidated.join(', ') + ' n\'ont pas encore validé leur mission !';
                } else if (isAlert2) {
                    title = '🔔 Rappel 20h — Plus que quelques heures !';
                    body  = unvalidated.join(', ') + ' — Validez avant ce soir.';
                } else {
                    title = '🚨 23h30 — DERNIÈRE CHANCE avant malus !';
                    body  = unvalidated.join(', ') + ' — Validez avant minuit ou perdez 2 points !';
                }

                sendAlarmNotif(title, body, alertKey);
            });
        });
    });
}

/* ── ENVOI NOTIFICATION ALARME (son d'alarme) ──────────────────── */
function sendAlarmNotif(title, body, tag) {
    self.registration.showNotification(title, {
        body            : body,
        icon            : '/icon-192.png',
        badge           : '/icon-192.png',
        /* Son d'alarme via vibration longue + son système */
        vibrate         : [500, 200, 500, 200, 500, 200, 1000],
        tag             : tag || 'alarm',
        requireInteraction: true,
        silent          : false,   /* Active le son système de la notif */
        actions: [
            { action: 'open',    title: '📱 Valider maintenant' },
            { action: 'dismiss', title: 'Ignorer' }
        ]
    });
}

/* ── ENVOI NOTIFICATION VALIDATION (son doux) ──────────────────── */
function sendValidationNotif(nom, mission) {
    self.registration.showNotification('✅ ' + nom + ' a validé sa tâche !', {
        body   : mission + ' — C\'est fait cette semaine 💪',
        icon   : '/icon-192.png',
        badge  : '/icon-192.png',
        vibrate: [100, 50, 100],   /* Vibration courte et douce */
        tag    : 'validation-' + nom + '-' + Date.now(),
        silent : false,            /* Son système activé */
        requireInteraction: false  /* Disparaît automatiquement */
    });
}

/* ── MALUS AUTOMATIQUE 23h59 ───────────────────────────────────── */
function handleAutoMalus(now) {
    var weekNum  = getWeekNumber();
    var malusKey = 'malus_week_' + weekNum;

    caches.open(CACHE_NAME).then(function(cache) {
        cache.match(malusKey).then(function(already) {
            if (already) return;
            cache.put(malusKey, new Response('done'));

            fetch(SUPABASE_URL + '/rest/v1/scores?select=id,name,points,last_week_validated,tache_en_retard', { headers: HEADERS })
            .then(function(res) { return res.json(); })
            .then(function(users) {
                var nonValides = users.filter(function(u) {
                    return u.last_week_validated !== weekNum && !u.tache_en_retard;
                });

                if (nonValides.length === 0) return;

                var promises = nonValides.map(function(user) {
                    var newPoints = Math.max(0, user.points - 2);
                    return fetch(SUPABASE_URL + '/rest/v1/scores?id=eq.' + user.id, {
                        method : 'PATCH',
                        headers: Object.assign({}, HEADERS, { 'Prefer': 'return=minimal' }),
                        body   : JSON.stringify({ points: newPoints, tache_en_retard: weekNum, retard_valide: false })
                    }).then(function() {
                        return fetch(SUPABASE_URL + '/rest/v1/logs', {
                            method : 'POST',
                            headers: Object.assign({}, HEADERS, { 'Prefer': 'return=minimal' }),
                            body   : JSON.stringify({ name: user.name, points_gagnes: -2, type: 'malus_auto' })
                        });
                    });
                });

                Promise.all(promises).then(function() {
                    var names = nonValides.map(function(u) { return u.name; }).join(', ');
                    sendAlarmNotif(
                        '🚨 Malus automatique appliqué !',
                        names + ' ont perdu 2 points — tâche non validée.',
                        malusKey
                    );
                });
            });
        });
    });
}

/* ── HELPER : NON-VALIDÉS ──────────────────────────────────────── */
function getUnvalidatedColocs() {
    var weekNum = getWeekNumber();
    return fetch(SUPABASE_URL + '/rest/v1/scores?select=name,last_week_validated', { headers: HEADERS })
        .then(function(res) { return res.json(); })
        .then(function(users) {
            return users.filter(function(u) { return u.last_week_validated !== weekNum; })
                        .map(function(u) { return u.name; });
        })
        .catch(function() { return []; });
}

/* ── NUMÉRO DE SEMAINE (basé sur le lundi) ─────────────────────── */
function getWeekNumber() {
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var day = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    var days = Math.floor((monday - startOfYear) / 86400000);
    return Math.floor(days / 7) + 1;
}

/* ── CLIC SUR NOTIFICATION ─────────────────────────────────────── */
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'dismiss') return;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                if (clientList[i].url.indexOf(self.location.origin) !== -1 && 'focus' in clientList[i]) {
                    return clientList[i].focus();
                }
            }
            return clients.openWindow('/');
        })
    );
});
