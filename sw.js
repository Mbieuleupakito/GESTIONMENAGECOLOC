/* ================================================================
   SERVICE WORKER — GTM Coloc
   Gère les alertes automatiques du dimanche côté appareil.
   Les vraies notifications cross-appareils passent par OneSignal.
================================================================ */

// Importe le Service Worker OneSignal
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'gtm-coloc-v5';
const SUPABASE_URL = 'https://avpxzwjxmytdcmlxtixh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_CoTpQtG8306po9DCFDRyrg_4-nC16vM';
const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
};

self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()); });

self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SCHEDULE_CHECKS') {
        startCheckLoop();
    }
});

function startCheckLoop() {
    checkAndAct();
    setInterval(checkAndAct, 60 * 1000);
}

function checkAndAct() {
    var now = new Date();
    var day = now.getDay();
    var hour = now.getHours();
    var minute = now.getMinutes();
    if (day !== 0) return;
    var isAlert1 = hour === 15 && minute === 0;
    var isAlert2 = hour === 20 && minute === 0;
    var isAlert3 = hour === 23 && minute === 30;
    var isMalus  = hour === 23 && minute === 59;
    if (isAlert1 || isAlert2 || isAlert3) handleAlert(isAlert1, isAlert2, isAlert3, now);
    if (isMalus) handleAutoMalus(now);
}

function handleAlert(a1, a2, a3, now) {
    var key = 'alert_' + now.toISOString().slice(0, 15);
    caches.open(CACHE_NAME).then(function(cache) {
        cache.match(key).then(function(already) {
            if (already) return;
            cache.put(key, new Response('sent'));
            getUnvalidated().then(function(names) {
                if (!names.length) return;
                var title, body;
                if (a1) { title = 'Rappel 15h — Mission non faite !'; body = names.join(', ') + ' n\'ont pas valide !'; }
                else if (a2) { title = 'Rappel 20h — Plus que quelques heures !'; body = names.join(', ') + ' — Validez avant ce soir.'; }
                else { title = 'DERNIERE CHANCE 23h30 !'; body = names.join(', ') + ' — Validez avant minuit ou perdez 2 points !'; }
                self.registration.showNotification(title, {
                    body: body, icon: '/icon-192.png', vibrate: [200,100,200],
                    tag: key, requireInteraction: true,
                    actions: [{action:'open', title:'Valider maintenant'}]
                });
            });
        });
    });
}

function handleAutoMalus(now) {
    var weekNum = getWeekNumber();
    var key = 'malus_week_' + weekNum;
    caches.open(CACHE_NAME).then(function(cache) {
        cache.match(key).then(function(already) {
            if (already) return;
            cache.put(key, new Response('done'));
            fetch(SUPABASE_URL + '/rest/v1/scores?select=id,name,points,last_week_validated,tache_en_retard', {headers: HEADERS})
            .then(function(r) { return r.json(); })
            .then(function(users) {
                var nv = users.filter(function(u) { return u.last_week_validated !== weekNum && !u.tache_en_retard; });
                nv.forEach(function(user) {
                    fetch(SUPABASE_URL + '/rest/v1/scores?id=eq.' + user.id, {
                        method: 'PATCH',
                        headers: Object.assign({}, HEADERS, {'Prefer':'return=minimal'}),
                        body: JSON.stringify({points: Math.max(0, user.points-2), tache_en_retard: weekNum, retard_valide: false})
                    });
                    fetch(SUPABASE_URL + '/rest/v1/logs', {
                        method: 'POST',
                        headers: Object.assign({}, HEADERS, {'Prefer':'return=minimal'}),
                        body: JSON.stringify({name: user.name, points_gagnes: -2, type: 'malus_auto'})
                    });
                });
                if (nv.length) {
                    self.registration.showNotification('Malus automatique applique !', {
                        body: nv.map(function(u){return u.name;}).join(', ') + ' ont perdu 2 points.',
                        icon: '/icon-192.png', vibrate: [300,100,300], tag: key
                    });
                }
            });
        });
    });
}

function getUnvalidated() {
    var wn = getWeekNumber();
    return fetch(SUPABASE_URL + '/rest/v1/scores?select=name,last_week_validated', {headers: HEADERS})
        .then(function(r) { return r.json(); })
        .then(function(u) { return u.filter(function(x){return x.last_week_validated!==wn;}).map(function(x){return x.name;}); })
        .catch(function() { return []; });
}

function getWeekNumber() {
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 1);
    var day = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return Math.floor(Math.floor((monday - startOfYear) / 86400000) / 7) + 1;
}

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.matchAll({type:'window'}).then(function(list) {
        for (var i=0; i<list.length; i++) {
            if ('focus' in list[i]) return list[i].focus();
        }
        return clients.openWindow('/');
    }));
});
