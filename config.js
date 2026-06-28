/* ================================================================
   CONFIG.JS — Configuration Supabase, donnees, helpers DB & Ntfy
   GTM Coloc — doit etre charge EN PREMIER
================================================================ */


        var SUPABASE_URL = 'https://avpxzwjxmytdcmlxtixh.supabase.co';
        var SUPABASE_KEY = 'sb_publishable_CoTpQtG8306po9DCFDRyrg_4-nC16vM';
        var HEADERS = {'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json'};

        var NTFY_BASE = 'https://ntfy.sh/';
        var NTFY_GLOBAL_CHANNEL = 'gtm-coloc-appart48';

        /* Genere un canal Ntfy unique a partir du nom — fonctionne pour n'importe quel nom */
        function slugify(str) {
            return str.toString().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') /* retire les accents */
                .replace(/[^a-z0-9]+/g, '') /* retire tout sauf lettres/chiffres */
                .slice(0, 20);
        }
        function getNtfyChannel(nom) {
            if (!nom) return NTFY_GLOBAL_CHANNEL;
            return 'gtm-' + slugify(nom);
        }

        function sendNtfyNotification(title, body, targets, urgent) {
            var priority = urgent ? '5' : '3';
            var tags = urgent ? ['rotating_light','warning'] : ['bell','house'];
            function ntfyPost(channel) {
                return fetch(NTFY_BASE + channel, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        topic: channel,
                        title: title.replace(/[^\x00-\x7F]/g,'').trim() || 'GTM Coloc',
                        message: body,
                        priority: parseInt(priority),
                        tags: tags
                    })
                }).catch(function(e){ console.error('Ntfy error', e); });
            }
            if (!targets || targets.length === 0) return ntfyPost(NTFY_GLOBAL_CHANNEL);
            return Promise.all(targets.map(function(nom) {
                return ntfyPost(getNtfyChannel(nom));
            }));
        }

        function dbGet(table, cols, filters, order, limit) {
            var url = SUPABASE_URL + '/rest/v1/' + table + '?select=' + (cols || '*');
            if (filters) filters.forEach(function(f){ url += '&' + f; });
            if (order) url += '&order=' + order;
            if (limit) url += '&limit=' + limit;
            return fetch(url, {headers: HEADERS}).then(function(r){return r.json();}).then(function(d){return Array.isArray(d)?d:[];}).catch(function(){return [];});
        }
        function dbUpdate(table, obj, filters) {
            var url = SUPABASE_URL + '/rest/v1/' + table;
            if (filters && filters.length) url += '?' + filters.join('&');
            return fetch(url, {method:'PATCH', headers:Object.assign({},HEADERS,{'Prefer':'return=minimal'}), body:JSON.stringify(obj)}).catch(function(){});
        }
        function dbInsert(table, obj) {
            return fetch(SUPABASE_URL + '/rest/v1/' + table, {method:'POST', headers:Object.assign({},HEADERS,{'Prefer':'return=minimal'}), body:JSON.stringify(Array.isArray(obj)?obj[0]:obj)}).catch(function(){});
        }
        function dbDelete(table, filters) {
            var url = SUPABASE_URL + '/rest/v1/' + table;
            if (filters && filters.length) url += '?' + filters.join('&');
            return fetch(url, {method:'DELETE', headers:Object.assign({},HEADERS,{'Prefer':'return=minimal'})}).catch(function(){});
        }

        var colocs = []; /* Chargé dynamiquement depuis Supabase au démarrage */
        /* Repartition dynamique des 5 taches fixes — voir getAssignedMissions() plus bas */
        var missions = ["🚿 Douche Gauche","🚽 WC Droit","🧹 Cuisine + Salon","🧻 WC Gauche","🚿 Douche Droite"];

        /* ── LISTE COMPLÈTE DES TÂCHES ── */
        var allTasks = [
            /* Douches */
            "🚿 Douche Gauche", "🚿 Douche Droite",
            /* WC */
            "🚽 WC Droit", "🧻 WC Gauche",
            /* Cuisine */
            "🧹 Cuisine + Salon", "🪣 Lavage Cuisine", "🧽 Nettoyage Cuisinière",
            "📦 Nettoyage Micro-ondes", "🧊 Nettoyage Réfrigérateur", "🪣 Lavage Sol Cuisine",
            /* Salon / Couloir */
            "🧹 Balayage Salon + Couloir", "🪣 Lavage Salon", "🪣 Lavage Couloir",
            /* Salle de bain */
            "🪣 Lavage Salle de Bain", "🧴 Nettoyage Lavabo", "🛁 Nettoyage Baignoire",
            /* Général */
            "🏠 Ménage Général Complet", "🪟 Nettoyage Vitres", "🗑️ Vider les Poubelles",
            "🧺 Lessive Commune", "🧹 Balayage Escalier", "🪣 Lavage Escalier",
            /* Personnalisé — sera géré par saisie libre */
        ];

        var myChart;
        var selectedMsgTargets = [];
        var selectedNotifTargets = [];
        var taskOverridesCache = {};
        var taskPendingChanges = {};
