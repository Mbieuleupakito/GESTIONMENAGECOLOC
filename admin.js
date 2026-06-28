/* ================================================================
   ADMIN.JS — Panel admin, gestion colocataires, malus, reset
================================================================ */

        /* ── MALUS & RESET ── */
function applyMalus(id, nom, current) {
            if (!confirm('Punir '+nom+' (-2 pts) ?')) return;
            dbUpdate('scores',{points:Math.max(0,current-2)},['id=eq.'+id]).then(function(){
                dbInsert('logs',{name:nom,points_gagnes:-2,type:'malus'});
                showToast('Malus applique a '+nom);
                fetchAllData();
            });
        }

        function resetAllScores() {
            if (!confirm('Reset Total du mois ?')) return;
            dbUpdate('scores',{points:0,last_week_validated:0,tache_en_retard:null,retard_valide:false,partial_week:null,done_missions:''},['id=neq.0']).then(function(){
                dbDelete('logs',['id=neq.0']);
                location.reload();
            });
        }


        /* ── ADMIN ── */
        var adminClicks=0, adminTimer=null;
        document.getElementById('admin-trigger').addEventListener('click', function(e){
            e.preventDefault();
            adminClicks++;
            clearTimeout(adminTimer);
            adminTimer=setTimeout(function(){adminClicks=0;},2000);
            if(adminClicks>=5){adminClicks=0;clearTimeout(adminTimer);document.getElementById('admin-panel').classList.remove('hidden');}
        });
        function closeAdmin(){document.getElementById('admin-panel').classList.add('hidden');selectedNotifTargets=[];}


        /* ── GESTION DYNAMIQUE DES COLOCATAIRES ───────────────────────
           Permet d'ajouter ou retirer des colocataires directement
           depuis l'app, sans toucher au code.
        ──────────────────────────────────────────────────────── */
        function buildColocManageList(users) {
            var c = document.getElementById('coloc-manage-list');
            if (!c) return;
            var actifs = users.filter(function(u){ return u.actif !== false; });
            var inactifs = users.filter(function(u){ return u.actif === false; });

            var html = actifs.map(function(u) {
                return '<div class="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-xl">' +
                    '<span class="text-xs font-bold">' + u.name + ' <span class="text-slate-400 font-normal">(' + u.points + ' pts)</span></span>' +
                    '<button onclick="removeColocataire(' + u.id + ', \'' + u.name + '\')" class="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black">Retirer</button>' +
                    '</div>';
            }).join('');

            if (inactifs.length) {
                html += '<p class="text-[8px] text-slate-400 font-bold uppercase mt-3 mb-1">Comptes retires</p>';
                html += inactifs.map(function(u) {
                    return '<div class="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-2 rounded-xl opacity-70">' +
                        '<span class="text-xs font-bold line-through">' + u.name + '</span>' +
                        '<button onclick="reactivateColocataire(' + u.id + ', \'' + u.name + '\')" class="bg-green-500 text-white px-3 py-1 rounded-lg text-[10px] font-black">Réactiver</button>' +
                        '</div>';
                }).join('');
            }
            c.innerHTML = html;
        }

        function removeColocataire(id, nom) {
            if (!confirm('Retirer ' + nom + ' de la coloc ?\n\nSon acces sera immediatement coupe (meme avec le bon mot de passe). Son historique de points est conserve et il pourra etre reintegre plus tard.')) return;
            dbUpdate('scores', { actif: false }, ['id=eq.'+id]).then(function() {
                var wn = getWeekNumber();
                dbDelete('task_overrides', ['nom=eq.'+nom, 'semaine=eq.'+wn]);
                dbDelete('task_overrides', ['nom=eq.'+nom+'_extra', 'semaine=eq.'+wn]);
                showToast(nom + ' a ete retire — acces coupe immediatement.');
                fetchAllData();
            });
        }

        function reactivateColocataire(id, nom) {
            dbUpdate('scores', { actif: true }, ['id=eq.'+id]).then(function() {
                showToast(nom + ' a ete reintegre a la coloc !');
                fetchAllData();
            });
        }

