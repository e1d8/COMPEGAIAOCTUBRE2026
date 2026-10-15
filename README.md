# Resultats de la competició Gaia Climb

Web estàtica en valencià amb el rànquing i les estadístiques de les participacions guardades en **Firebase Firestore** pel formulari de Gaia Climb. Utilitza la mateixa base de dades del projecte **`compe-gaia-octubre-2026`**, col·lecció **`resultados`**.

## Funcionament

- La web consulta Firestore en obrir-se i en reintentar després d’un error. Per a vore enviaments o canvis posteriors, recarrega la pàgina. No hi ha actualització automàtica ni consultes periòdiques.
- Cada document representa un dorçal únic. L’ID del document es correspon amb `dorsal`; reenviar el formulari amb el mateix dorçal reemplaça eixa participació i no n’afegix una altra.
- El model usa `dorsal`, `anonimo`, `nombre`, `genero`, `bloque1`…`bloque17`, `intentos`, `total` i `updated_at` del servidor. No hi ha correus electrònics.
- Els anònims apareixen com `Anònim`, amb gènere `Altre`; compten en el rànquing general i en totes les estadístiques. No apareixen en les categories Femení o Masculí.
- Cada bloc val `0`, `Zona` (10 punts) o `Top` (25 punts), amb un màxim de 425.
- Les categories Femení i Masculí utilitzen el valor exacte de `genero`. A igualtat de punts, va davant qui suma menys intents **només en els blocs amb Zona o Top**. Si també coincidixen els intents, compartixen posició amb numeració densa (`1, 2, 2, 3`) i s’ordenen per nom i després per ID del document. Els blocs sense puntuació no intervenen en el desempat. Si falten intents en algun bloc puntuat, eixa participació queda darrere de les que tenen dades completes a igualtat de punts; dos registres amb dades incompletes mantenen l’empat.
- Les persones amb zero punts apareixen al rànquing i compten en el total i en la mitjana. El rànquing mostra cinc participants per pàgina.
- **Puntuació per bloc** mostra la quantitat de participants amb zona sense top o amb top.
- **Intents per bloc** suma els intents segons el resultat final: Top (verd de primera posició), Zona (segona) o No puntuat (tercera). Per exemple, dos tops de 2 i 3 intents aporten 5 al segment Top. Les participacions amb zero intents aporten zero, sense inferir-ne cap altre valor.
- **Mitja d’intents per bloc** mostra tres barres per bloc, en l’ordre Top, Zona i No puntuat, amb els mateixos colors. Cada mitja és la suma d’intents del grup dividida pel nombre de participants d’eixe grup amb intents vàlids, inclòs el valor 0. Les dades absents o invàlides no entren en el denominador. Un grup sense dades queda buit (no equival a una mitja zero); les etiquetes accessibles ho indiquen. Els valors es mostren amb un màxim d’un decimal, però els càlculs i les altures usen la precisió completa. Les mitjanes no se sumen.
- `intentos[0]` correspon al bloc 1 i `intentos[16]` al bloc 17. El formulari envia ara números exactes de 0 a 99. Es conserven els valors antics: `4+` aporta un mínim de 4 intents i `5+` un mínim de 5. No és possible recuperar el número exacte d’eixes participacions antigues.
- Els intents absents o invàlids s’exclouen de la suma. Les participacions continuen comptant en el rànquing, la mitjana i el gràfic de puntuació. Si encara no hi ha cap dada d’intents, apareix un missatge específic; els zeros vàlids sí que es consideren dades.
- L’ordre de les gràfiques és **Puntuació per bloc → Mitja d’intents per bloc → Intents per bloc**.
- Cada gràfic té paginació independent amb cinc pàgines: `4 + 4 + 4 + 4 + 1`. L’escala és comuna a totes les pàgines de cada gràfic: participants en **Puntuació per bloc**, màxim de la suma d’intents en **Intents per bloc** i màxim de les mitjanes individuals (arrodonit cap amunt a una dècima) en **Mitja d’intents per bloc**. Els tres usen totes les categories, independentment de la pestanya del rànquing.

La web usa **Firestore Lite 12.4.0**, carregat des del CDN oficial de Firebase. No necessita npm, compilació ni servidor propi. Les dades es consulten al servidor, sense memòria cau persistent de Firestore. Les consultes estan subjectes a les [quotes de Firestore](https://firebase.google.com/docs/firestore/quotas); canviar de categoria o de pàgina usa les dades ja carregades i no fa una altra consulta.

## Configuració

El bloc `firebaseConfig` del principi de `script.js` ja correspon al projecte i a l’aplicació **Compe Gaia Octubre 2026** que utilitza el formulari. No cal registrar una altra aplicació web ni crear una altra base de dades.

1. Obri [Firebase](https://console.firebase.google.com/) i selecciona **`compe-gaia-octubre-2026`**.
2. Comprova en **Firestore Database → Dades** que la base **`(default)`** conté la col·lecció `resultados`. Si encara no existix la col·lecció, apareixerà després del primer enviament vàlid del formulari.
3. En **Regles**, publica la versió actual del fitxer `firestore.rules` del projecte **FormulariCompeGaia**, que admet intents de 0 a 99. Les mateixes regles permeten la lectura pública de `resultados`, sense permisos addicionals ni regles obertes.
4. Per al comptador d’intents 0–99, publica primer les regles ampliades del formulari, després esta web en GitHub Pages i finalment el formulari. Les regles antigues només admeten fins a 5 intents. Comprova les participacions després de publicar.

La configuració web és pública; els permisos els controlen les regles. Esta pàgina només consulta dades. No conté operacions de creació, actualització ni esborrat. [Configuració de Firebase](https://firebase.google.com/docs/web/setup), [lectura de documents](https://firebase.google.com/docs/firestore/query-data/get-data).

## Prova local

Des de la carpeta del projecte:

```sh
python3 -m http.server 8001
```

Obri `http://localhost:8001`. Per a provar també el formulari, pots servir-lo en el port 8000. No òbrigues `index.html` com a fitxer local, perquè els mòduls de Firebase poden quedar bloquejats pel navegador.

Comprova:

- Càrrega correcta, estat sense resultats, errors de xarxa o permisos i botó `Torna-ho a provar`.
- Rànquing general, Femení i Masculí; desempat per intents de blocs puntuats, empat complet, dades incompletes, noms llargs, zeros i més de cinc participants.
- Total de participants i mitjana arrodonida, amb els anònims inclosos.
- Recompte de zones i tops i sumes d’intents per resultat en les cinc pàgines de cada gràfic, amb el bloc 17 en l’última i paginació independent.
- Mitjanes separades per Top, Zona i No puntuat, zeros vàlids, grups sense participants, decimals i paginació independent dels tres gràfics.
- Intents 0, 6, 25 i 99, valors antics `4+` i `5+`, dades absents o invàlides, i escala comuna entre les pàgines.
- Navegació amb teclat i amplada mínima de 320 px.
- Enviar un dorçal nou des del formulari i recarregar esta web: ha d’aparéixer en la categoria corresponent.
- Reenviar el mateix dorçal amb altres puntuacions o en mode anònim: després de recarregar, ha de canviar la mateixa participació sense augmentar el recompte.

Si hi ha un error de permisos, revisa les regles publicades en el projecte correcte. Si hi ha un error de configuració, comprova que la base `(default)` existix i que les dos webs utilitzen el mateix `firebaseConfig`.

## Proves dels càlculs

Amb Node.js, pots executar les proves de desempat, categories, dades antigues, mitjanes i valors invàlids sense connectar amb Firebase:

```sh
node --test tests/calculs.test.cjs
```

## Publicació i retirada de Google Sheets

Publica `index.html`, `styles.css`, `script.js` i `Gaia.svg` en GitHub Pages mitjançant **Settings → Pages → Deploy from a branch**. Després de cada canvi, espera que acabe el desplegament i recarrega sense memòria cau. El número de versió del JavaScript s’ha actualitzat per a evitar que s’use la versió anterior.

Esta web ja no consulta Google Sheets ni Google Apps Script. Els resultats antics no s’importen automàticament a Firestore. Quan hages comprovat les dos webs publicades, pots retirar la implementació antiga d’Apps Script i conservar el Sheet com a arxiu, si vols.
