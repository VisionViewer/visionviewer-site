# VisionViewer

Prototype mobile-first : sélection de fauteuils de cinéma, avec une vue 3D de l'écran depuis chaque siège. Le site a deux pages : la présentation (`/`) et la démo (`/demo`).

React · Vite · TypeScript · Three.js (`@react-three/fiber`, `@react-three/drei`) · Motion. Aucun backend : les salles sont des fichiers JSON.

## Lancement

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173 pour la présentation, ou http://localhost:5173/demo pour la démo (idéalement en mode mobile, ~390 px de large).

| Commande | Effet |
| --- | --- |
| `npm run dev -- --host` | expose le serveur sur le réseau local, pour tester sur un vrai téléphone |
| `npm run build` | vérifie les types puis génère `dist/` |
| `npm test` | tests du calcul des salles (positions, rangée K, indicateurs) |
| `npm run deploy` | construit ici puis met en ligne sur Vercel, sans passer par GitHub (en secours : voir « Démo en ligne ») |

## Ajouter une salle

1. Copier `src/data/rooms/01-salle-1.json` vers un nouveau fichier du même dossier, par exemple `03-ma-salle.json`. L'ordre alphabétique des fichiers est celui du sélecteur de salle.
2. Adapter les champs ci-dessous.
3. C'est tout : le fichier est chargé automatiquement, et le plan 2D comme la scène 3D sont générés à partir de lui. Les erreurs de saisie courantes (siège occupé inexistant, rangée inconnue…) sont signalées dans la console.

| Champ | Rôle |
| --- | --- |
| `id`, `name` | identifiant unique et nom affiché |
| `description` | une phrase qui décrit la salle, affichée par la page de présentation (optionnel) |
| `rows` | lettres des rangées, **de l'écran vers le fond** |
| `seatsPerRow` | nombre d'emplacements par rangée, numérotés à partir de 1 |
| `seatOneSide` | côté du fauteuil n°1 **sur le plan** (écran en bas) : `"left"` (défaut) ou `"right"` |
| `aislesAfter` | allées intérieures : `[6, 18]` insère une allée après les fauteuils 6 et 18 |
| `rowOverrides` | par rangée, positions vides (`empty`), PMR (`pmr`) ou places doubles (`double`) : `{ "K": { "empty": [3], "pmr": [2], "double": [5] } }`. Pour `double`, chaque numéro est la première des deux positions : `[5]` crée la place double 5-6 |
| `occupied` | sièges déjà pris : `["I7", "I8"]` ; une place double se note `"R1-2"` |
| `preselected` | siège sélectionné à l'ouverture (optionnel) |
| `price` | prix d'une place, en euros |
| `screenImage` | image projetée, relative à `public/` (optionnel ; sans image, l'écran est blanc) |

Dimensions physiques (`dimensions`, en mètres) :

| Champ | Rôle |
| --- | --- |
| `screenWidth`, `screenHeight` | taille de l'écran |
| `screenBottomHeight` | hauteur du bas de l'écran au-dessus du sol du premier rang (défaut 1,2) |
| `screenToFirstRow` | distance entre l'écran et le premier rang |
| `rowSpacing` | espacement entre deux rangées |
| `seatWidth` | largeur d'un siège, d'axe en axe |
| `stepHeight` | hauteur de marche du gradin, par rangée |
| `aisleWidth` | largeur d'une allée intérieure (défaut 1,1) |

Le schéma complet et commenté est dans `src/lib/room.ts` (`RoomConfig`).

## Changer l'image de l'écran

Sans rien régler, l'écran est blanc et lumineux, comme dans la page de présentation. Pour y projeter une image, la déposer dans `public/screens/` et l'indiquer dans le champ `screenImage` de la salle, par exemple `"screenImage": "screens/mire.png"` (une mire de test neutre, fournie). L'image remplit l'écran sans être déformée (recadrage centré si les formats diffèrent).

Dans la démo, les deux salles projettent un logo au centre de l'écran : l'emplacement « Votre logo ici » (`"screenLogo": "screens/votre-logo-ici.png"`), pour montrer à un cinéma où ira le sien. Un logo garde ses proportions et l'écran reste blanc autour de lui ; `screenImage`, s'il est donné, l'emporte. Retirer le champ `screenLogo` rend l'écran blanc.


## Conventions

- **Gauche / droite** : le plan est une vue de dessus avec l'écran en bas. La gauche du plan est donc la **droite** du spectateur assis face à l'écran : depuis A1 (en bas à gauche du plan), l'écran s'étend vers la gauche.
- **Caméra** : placée aux yeux d'une personne assise (1,15 m au-dessus du sol de sa rangée, `EYE_HEIGHT` dans `src/lib/view.ts`) et tournée vers le centre de l'écran. On peut tourner la tête (glisser, flèches du clavier) de ±75° en horizontal et ±40° en vertical, sans se déplacer.
- **Distance à l'écran** et **angle de vision** : calculés par `viewMetrics` (`src/lib/view.ts`), ils ne sont plus affichés dans la démo. La distance va des yeux au centre de l'écran ; l'angle est celui sous lequel on voit toute la largeur de l'écran.
- Les sièges occupés portent une silhouette de spectateur dans la vue 3D, pour juger de la gêne.
- **Places doubles** : une banquette de deux largeurs, sans accoudoir central, vendue pour deux places (le total double). Elle ne peut pas être à cheval sur une allée ni recouvrir un emplacement vide ou PMR ; une place mal placée est ignorée et signalée dans la console.
- **Plan 2D** : il s'ouvre dézoomé, pour montrer toute la salle. Sur écran tactile, si les sièges sont trop petits pour le doigt, le premier toucher zoome à l'endroit touché.
- **Comparer les places** : dans la vue 3D, le pavé directionnel passe au fauteuil libre voisin (gauche, droite, rangée de devant ou de derrière) ; « Choisir ce siège » sélectionne celui qu'on regarde.

## Démo en ligne

Le site est publié sur https://visionviewer.vercel.app (non référencé par les moteurs de recherche).

**Publier** : envoyer sur la branche `main` de ce dépôt. Vercel (projet `visionviewer`) construit alors le site et le met en ligne ; une autre branche donne une préversion, réservée aux comptes Vercel de l'équipe.

- **Présentation** (`/`, fichier `index.html`) : la page VisionViewer, reprise de la maquette `visionviewer-landing.html`. Une salle en points de lumière se construit au défilement, puis viennent les sections « Sur mesure », « Intégration », les chiffres, « Démo » et le contact.
- **Démo** (`/demo`, fichier `demo.html`) : l'application de réservation. Sur téléphone, elle occupe tout l'écran, avec un bandeau pour changer de salle et revenir à la présentation. Sur ordinateur, elle est présentée dans un téléphone, à côté d'un panneau qui porte le choix de la salle et le QR code.
- **De l'une à l'autre** : les boutons « Essayez maintenant » de la présentation et les QR codes (section « Démo » de la présentation, panneau de la démo sur ordinateur) mènent à `/demo`, sur le plan de salle : au visiteur de choisir son fauteuil, puis d'ouvrir la vue 3D. Les QR codes ne s'affichent pas en local : un téléphone n'a pas accès à `localhost`.
- L'adresse `/demo` repose sur une règle de réécriture vers `demo.html` (`vercel.json`). L'ancienne adresse `/?demo` y redirige.
- Si le site change de domaine, mettre à jour les balises `og:` de `index.html` et de `demo.html`.

### Modifier la présentation

- Le texte est dans `index.html`, les styles dans `src/landing/landing.css` (ceux de la maquette, plus quelques ajouts regroupés en fin de fichier).
- **Les salles de la page sont celles de la démo** : `src/landing/halls.ts` lit les JSON de `src/data/rooms/`. La scène 3D (`scene.js`, repris de la maquette, en JavaScript) et la coupe de la Fig. 1 (`coupe.ts`) montrent donc les mêmes fauteuils, les mêmes places doubles et les mêmes spectateurs que la démo : la première salle est racontée, la deuxième sert à la transformation finale.
- Les chiffres écrits dans le texte de `index.html` (places, écran, pente, légende de la coupe) se modifient à la main. `npm test` signale ceux qui ne correspondent plus au JSON de la première salle.
- `src/landing/main.ts` porte le reste : liens vers la démo, QR code, carrousel des chiffres et adresse de contact (constante `CONTACT`, encore un exemple à remplacer).
- Sur écran tactile, la section « Démo » n'affiche pas de QR code, seulement le bouton. Sans WebGL, la scène est retirée et la page reste lisible.
- Le fauteuil géant de l'ouverture est décrit dans `scene.js` (fonctions `seatBack`, `seatCushion`, `seatArm`, `seatFrame`) : dossier, assise, accoudoirs à porte-gobelet, flancs. La coupe de la Fig. 1 se redessine à la largeur disponible, pour tenir en entier sur un téléphone.

### Ce qui se charge, et quand

- **Présentation** : le texte s'affiche avec la page. La scène 3D et three.js sont annoncés dès le HTML (plugin `preloadLandingScene` de `vite.config.ts`) et téléchargés en même temps que le reste, sans bloquer l'affichage. Le générateur de QR code n'est chargé que là où le code s'affiche.
- **Démo** : le premier affichage ne charge que React et l'écran de réservation. Arrivent ensuite, à part : le moteur d'animation (`src/lib/motionFeatures.ts`, via `LazyMotion`), les bandeaux d'information (`src/lib/notify.ts`), le panneau de démo sur ordinateur, puis la vue 3D dès qu'un fauteuil est sélectionné.
- Les polices du premier écran sont préchargées dans `index.html` et `demo.html`. Dans les composants de la démo, utiliser `m.div` (import `motion/react-m`) et non `motion.div` : `LazyMotion` est en mode strict et le signale.

## Logo

Le kit du logo est dans `logo/` : toutes les versions en SVG et en PNG, les icônes du site et un guide d'usage (`logo/guide.md`, vue d'ensemble dans `logo/planche.png`). Le site utilise quatre fichiers copiés dans `public/` : `logo.svg` (la version horizontale simplifiée, en blanc), `favicon.svg`, `favicon.ico` et `apple-touch-icon.png`. Pour changer de logo, remplacer ces fichiers.

## Structure

```
index.html, demo.html           les deux pages : présentation et démo
public/screens/mire.png         image de test, à projeter au besoin (`screenImage`)
public/og-visionviewer.jpg      vignette du lien (messageries, e-mail)
public/logo.svg, favicon.*      logo et icônes du site, tirés de logo/
logo/                           kit du logo et guide d'usage
src/data/rooms/*.json           une salle par fichier
src/lib/room.ts                 schéma JSON + calcul du plan 2D et des positions 3D
src/lib/view.ts                 position des yeux, distance, angle de vision
src/lib/links.ts, src/lib/qr.ts adresses des deux pages, QR code
src/components/                 écran de réservation, plan 2D, sélecteur de salle, panneau de démo (ordinateur)
src/landing/                    page de présentation : styles, scène 3D, coupe, comportements
src/components/seat-view/       vue 3D : interface, salle, fauteuils instanciés, caméra
src/styles/tokens.css           couleurs et typographie : écran de réservation (--c-*) et habillage VisionViewer (--v-*)
```
