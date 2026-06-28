/* ================================================================
   MESSAGING.JS — Messagerie coloc, WhatsApp, notifications ciblees
================================================================ */

        /* ── MESSAGERIE ── */
        function buildMsgTargets() {
            var c = document.getElementById('msg-targets');
            if (!c) return;
            var allSel = selectedMsgTargets.length === 0;
            var html = '<button onclick="toggleMsgTarget(\'ALL\')" class="col-span-3 ' +
                (allSel?'bg-blue-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300') +
                ' py-2 px-3 rounded-xl text-[10px] font-black">📢 TOUTE LA COLOC</button>';
            colocs.forEach(function(nom) {
                var sel = selectedMsgTargets.indexOf(nom) !== -1;
                html += '<button onclick="toggleMsgTarget(\'' + nom + '\')" class="' +
                    (sel?'bg-blue-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300') +
                    ' py-2 px-1 rounded-xl text-[9px] font-black text-center">' + nom + '</button>';
            });
            c.innerHTML = html;
        }
        function toggleMsgTarget(nom) {
            if (nom === 'ALL') { selectedMsgTargets = []; }
            else { var idx = selectedMsgTargets.indexOf(nom); if (idx===-1) selectedMsgTargets.push(nom); else selectedMsgTargets.splice(idx,1); }
            buildMsgTargets();
        }

        /* ── WHATSAPP MESSAGES RAPIDES ── */
        var WA_MESSAGES = {
            rappel_dimanche: "Bonjour les gars 🏠✨\n\nN'oublions pas de faire le ménage avant 23h59 ce soir !\nChacun doit valider sa tâche sur l'app GTM Coloc.\n\nMerci d'avance à tous 🙏\n@tous",
            rappel_urgent: "⚠️ URGENT — Il reste moins de 2 heures !\n\nCeux qui n'ont pas encore validé leur tâche sur GTM Coloc, faites-le maintenant avant le malus automatique à 23h59 !\n\n@tous",
            felicitations: "🎉 Bravo à toute la coloc !\n\nTout le monde a validé sa tâche cette semaine 👏\nC'est ça l'esprit coloc !\n\nMerci à tous 🏆"
        };

        function sendWhatsApp(type) {
            var msg = '';
            if (type === 'custom') {
                msg = document.getElementById('msg-text').value.trim();
                if (!msg) { showToast('Ecris un message dans la zone de texte !'); return; }
            } else {
                msg = WA_MESSAGES[type] || '';
            }
            /* Ouvre WhatsApp avec le message pré-rempli */
            /* wa.me sans numéro = ouvre WhatsApp pour choisir le contact */
            var url = 'https://wa.me/?text=' + encodeURIComponent(msg);
            window.open(url, '_blank');
        }

        function sendColocMessage() {
            var msg = document.getElementById('msg-text').value.trim();
            if (!msg) { showToast('Ecris un message !'); return; }
            var dest = selectedMsgTargets.length === 0 ? 'Toute la coloc' : selectedMsgTargets.join(', ');
            sendNtfyNotification('Message Coloc -> ' + dest, msg, selectedMsgTargets, false);
            playValidationSound();
            showToast('Message envoye a ' + dest + ' !');
            document.getElementById('msg-text').value = '';
            selectedMsgTargets = [];
            buildMsgTargets();
        }


        /* ── NOTIF CIBLÉE ── */
        function buildNotifTargets(users) {
            var c = document.getElementById('notif-targets');
            if (!c) return;
            c.innerHTML = colocs.map(function(nom){
                var user = users ? users.find(function(u){return u.name===nom;}) : null;
                var pts = user ? user.points : 0;
                var ok = user ? user.last_week_validated===getWeekNumber() : false;
                var sel = selectedNotifTargets.indexOf(nom) !== -1;
                return '<button onclick="toggleNotifTarget(\''+nom+'\')" class="'+(sel?'bg-blue-600 text-white':'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200')+' py-2 px-1 rounded-xl text-[9px] font-black text-center">'+(ok?'✅':'⏳')+'<br>'+nom+'<br><span class="text-[8px] opacity-70">'+pts+'pts</span></button>';
            }).join('');
        }
        function toggleNotifTarget(nom) {
            var idx=selectedNotifTargets.indexOf(nom);
            if(idx===-1) selectedNotifTargets.push(nom); else selectedNotifTargets.splice(idx,1);
            dbGet('scores','*',[],'points.desc').then(function(u){buildNotifTargets(u);});
            updateNotifPreview();
        }
        function updateNotifPreview() {
            var type=document.getElementById('notif-type').value;
            var preview=document.getElementById('notif-preview');
            document.getElementById('custom-msg-box').classList.toggle('hidden',type!=='custom');
            if (!selectedNotifTargets.length) { preview.textContent='Selectionne des destinataires...'; return; }
            var now=new Date(), day=now.getDay(), hour=now.getHours();
            var jr=day===0?0:7-day, hr=23-hour;
            var names=selectedNotifTargets.join(', '), msg='';
            if (type==='auto') {
                if (day===0&&hour>=22) msg=names+' — URGENCE ! Moins d\'1h avant le malus !';
                else if (day===0) msg=names+' — Il reste '+hr+'h ce dimanche.';
                else msg=names+' — Il reste '+jr+' jour'+(jr>1?'s':'')+' pour valider.';
            } else if (type==='jours') msg=names+' — '+jr+' jour'+(jr>1?'s':'')+' restant'+(jr>1?'s':'')+'!';
            else if (type==='heures') msg=day===0?(names+' — '+hr+'h restantes !'):'Disponible le dimanche uniquement.';
            else if (type==='urgent') msg=names+' — URGENCE ! Valide MAINTENANT !';
            else { var cm=document.getElementById('custom-msg').value; msg=cm?(names+' — '+cm):'Ecris ton message...'; }
            preview.textContent = msg;
        }
        function sendTargetedNotif() {
            if (!selectedNotifTargets.length) { showToast('Selectionne un destinataire !'); return; }
            var type=document.getElementById('notif-type').value;
            var now=new Date(), day=now.getDay(), hour=now.getHours();
            var jr=day===0?0:7-day, hr=23-hour;
            var urgent=(type==='urgent')||(type==='auto'&&day===0&&hour>=20);
            var title='', body='';
            if (type==='auto') {
                if (day===0&&hour>=22){title='URGENCE !';body=selectedNotifTargets.join(', ')+' — Moins d\'1h avant le malus !';}
                else if (day===0){title='Rappel dimanche';body=selectedNotifTargets.join(', ')+' — Il reste '+hr+'h.';}
                else{title='Rappel tache';body=selectedNotifTargets.join(', ')+' — Il reste '+jr+' jour'+(jr>1?'s':'')+' pour valider.';}
            } else if (type==='jours'){title='Rappel';body=selectedNotifTargets.join(', ')+' — '+jr+' jour'+(jr>1?'s':'')+' restant'+(jr>1?'s':'')+'!';}
            else if (type==='heures'){if(day!==0){showToast('Disponible le dimanche !');return;}title=hr+'h restantes';body=selectedNotifTargets.join(', ')+' — Valide avant minuit !';}
            else if (type==='urgent'){title='URGENT !';body=selectedNotifTargets.join(', ')+' — Valide MAINTENANT !';}
            else{var cm=document.getElementById('custom-msg').value;if(!cm){showToast('Ecris un message !');return;}title='Message de Pakito';body=selectedNotifTargets.join(', ')+' — '+cm;}
            if (urgent) playAlarmSound(); else playRappelSound();
            sendNtfyNotification(title, body, selectedNotifTargets, urgent);
            showToast('Notification envoyee !');
            selectedNotifTargets=[];
            dbGet('scores','*',[],'points.desc').then(function(u){buildNotifTargets(u);});
            document.getElementById('notif-preview').textContent='Selectionne des destinataires...';
        }


        /* ── TESTS ── */
        function testAlarme() { playAlarmSound(); sendNtfyNotification('TEST ALARME', 'Test alarme GTM Coloc', [], true); showToast('Alarme test envoyee !'); }
        function testValidation() { playValidationSound(); sendNtfyNotification('Test Validation', 'PAKITO a valide sa tache !', [], false); showToast('Notif test envoyee !'); }
        function testRappel() {
            dbGet('scores','name,last_week_validated').then(function(u){
                var nv=(u||[]).filter(function(x){return x.last_week_validated!==getWeekNumber();}).map(function(x){return x.name;});
                playRappelSound();
                if (nv.length) sendNtfyNotification('Rappel missions', nv.join(', ')+' n ont pas valide !', nv, false);
                showToast(nv.length?'Rappel envoye !':'Tout le monde a valide !');
            });
        }

