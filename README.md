# VisionViewer

Prototype mobile-first : sélection de fauteuils de cinéma, avec une vue 3D de l'écran depuis chaque siège. Le site existe en anglais et en français, chaque langue sous son préfixe : la présentation (`/en`, `/fr`), la démo (`/en/demo`, `/fr/demo`), le blog (`/en/blog`, `/fr/blog`) et les pages légales. `/` mène à l'anglais, la langue par défaut. Voir « Langues ».

React · Vite · TypeScript · Three.js (`@react-three/fiber`, `@react-three/drei`) · Motion. Aucun backend : les salles sont des fichiers JSON.

## Lancement

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173/fr pour la présentation, ou http://localhost:5173/fr/demo pour la démo (idéalement en mode mobile, ~390 px de large). `/en` et `/en/demo` pour l'anglais ; `/` y redirige, comme en ligne.

| Commande | Effet |
| --- | --- |
| `npm run dev -- --host` | expose le serveur sur le réseau local, pour tester sur un vrai téléphone |
| `npm run build` | vérifie les types puis génère `dist/` ; rappelle les mentions légales encore « À compléter » |
| `npm run preview` | sert `dist/` avec les en-têtes de sécurité de `vercel.json` (http://localhost:4173) : c'est là que la politique de contenu s'éprouve |
| `npm test` | tests du calcul des salles (positions, rangée K, indicateurs) et des pages (liens, règles de `vercel.json`, blog, référencement, traductions) |
| `npm run indexnow` | après une mise en ligne : annonce à Bing les pages du plan du site en ligne (`-- --essai` pour voir sans envoyer, `-- <adresse>` pour n'annoncer qu'une page) |
| `npm run programme` | les articles parus et programmés, jour par jour (`-- --jour` : les adresses du jour) |
| `npm run deploy` | construit ici puis met en ligne sur Vercel, sans passer par GitHub (en secours : voir « Démo en ligne ») |

## Ajouter une salle

1. Copier `src/data/rooms/01-salle-1.json` vers un nouveau fichier du même dossier, par exemple `03-ma-salle.json`. L'ordre alphabétique des fichiers est celui du sélecteur de salle.
2. Adapter les champs ci-dessous.
3. C'est tout : le fichier est chargé automatiquement, et le plan 2D comme la scène 3D sont générés à partir de lui. Les erreurs de saisie courantes (siège occupé inexistant, rangée inconnue…) sont signalées dans la console.

| Champ | Rôle |
| --- | --- |
| `id`, `name` | identifiant unique et nom affiché |
| `description` | une phrase qui décrit la salle, affichée par la page de présentation (optionnel) |
| `traductions` | le nom et la description de la salle dans d'autres langues, par code de langue : `{ "en": { "name": "Auditorium 1", "description": "…" } }` (optionnel ; sans traduction, la salle garde son nom) |
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

Le logo se traduit comme le nom de la salle, dans `traductions` : la démo anglaise projette « YOUR LOGO HERE » (`"traductions": { "en": { …, "screenLogo": "screens/your-logo-here.png" } }`). La langue est celle de la page (`<html lang>`) ; une langue sans logo à elle reprend celui du fichier. Les deux images sont dessinées pareil : 900 × 300, fond transparent, cadre pointillé `#a3a9b6`, texte en Helvetica Neue gras `#3d4250`, à la même largeur (786 px).


## Conventions

- **Gauche / droite** : le plan est une vue de dessus avec l'écran en bas. La gauche du plan est donc la **droite** du spectateur assis face à l'écran : depuis A1 (en bas à gauche du plan), l'écran s'étend vers la gauche.
- **Caméra** : placée aux yeux d'une personne assise (1,15 m au-dessus du sol de sa rangée, `EYE_HEIGHT` dans `src/lib/view.ts`) et tournée vers le centre de l'écran. On peut tourner la tête (glisser, flèches du clavier) de ±75° en horizontal et ±40° en vertical, sans se déplacer.
- **Distance à l'écran** et **angle de vision** : calculés par `viewMetrics` (`src/lib/view.ts`), ils ne sont plus affichés dans la démo. La distance va des yeux au centre de l'écran ; l'angle est celui sous lequel on voit toute la largeur de l'écran.
- Les sièges occupés portent une silhouette de spectateur dans la vue 3D, pour juger de la gêne.
- **Places doubles** : une banquette de deux largeurs, sans accoudoir central, vendue pour deux places (le total double). Elle ne peut pas être à cheval sur une allée ni recouvrir un emplacement vide ou PMR ; une place mal placée est ignorée et signalée dans la console.
- **Plan 2D** : il s'ouvre dézoomé, pour montrer toute la salle. Sur écran tactile, si les sièges sont trop petits pour le doigt, le premier toucher zoome à l'endroit touché.
- **Comparer les places** : dans la vue 3D, le pavé directionnel passe au fauteuil libre voisin (gauche, droite, rangée de devant ou de derrière) ; « Choisir ce siège » sélectionne celui qu'on regarde.

## Démo en ligne

Le site est publié sur https://visionviewer.net. Il est ouvert aux moteurs de recherche et aux assistants, pages légales exceptées : voir « Référencement ».

**Publier** : envoyer sur la branche `main` de ce dépôt. Vercel (projet `visionviewer`) construit alors le site et le met en ligne ; une autre branche donne une préversion, réservée aux comptes Vercel de l'équipe.

- **Présentation** (`/fr`, fichier `fr.html` ; `/en`, fichier `en.html`) : la page VisionViewer, reprise de la maquette `visionviewer-landing.html`. Une salle en points de lumière se construit au défilement, puis viennent les sections « Sur mesure », « Intégration », les chiffres, « Démo », les questions fréquentes et le contact.
- **Démo** (`/fr/demo`, fichier `fr/demo.html` ; `/en/demo`, fichier `en/demo.html`) : l'application de réservation, la même dans chaque langue, ses textes exceptés. Sur téléphone, elle occupe tout l'écran, avec un bandeau pour changer de salle et revenir à la présentation. Sur ordinateur, elle est présentée dans un téléphone, à côté d'un panneau qui porte le choix de la salle et le QR code.
- **De l'une à l'autre** : les boutons « Essayez maintenant » de la présentation et les QR codes (section « Démo » de la présentation, panneau de la démo sur ordinateur) mènent à la démo **dans la langue de la page** (`src/lib/links.ts`), sur le plan de salle : au visiteur de choisir son fauteuil, puis d'ouvrir la vue 3D. Les QR codes ne s'affichent pas en local : un téléphone n'a pas accès à `localhost`.
- Une adresse sans « .html » repose sur une règle de réécriture de `vercel.json` ; les anciennes adresses (`/`, `/demo`, `/blog`…) y sont redirigées. Voir « Langues ».
- Si le site change de domaine, mettre à jour `SITE` dans `tools/pages.ts` (adresses canoniques, plan du site, données structurées), `public/robots.txt`, `src/pages/llms.md`, et l'adresse de l'image `og:image` dans `fr.html`, `en.html`, les deux `demo.html` et `src/pages/partials/head.html`.

### Modifier la présentation

- Le texte est dans `fr.html` et `en.html`, les styles dans `src/landing/landing.css` (ceux de la maquette, plus quelques ajouts regroupés en fin de fichier). **Les présentations de toutes les langues sont la même page** : même structure, mêmes identifiants, mêmes scripts. Un texte changé dans l'une se reporte dans les autres.
- Les **questions fréquentes** (section « Questions fréquentes ») sont écrites dans la page, entre `<!--@faq-->` et `<!--@/faq-->` : chaque question porte `data-q`, chaque réponse `data-a`. `tools/pages.ts` les reprend dans les données structurées. Autant de questions en français qu'en anglais : `npm test` le vérifie.
- **Les salles de la page sont celles de la démo** : `src/landing/halls.ts` lit les JSON de `src/data/rooms/`. La scène 3D (`scene.js`, repris de la maquette, en JavaScript) et la coupe de la Fig. 1 (`coupe.ts`) montrent donc les mêmes fauteuils, les mêmes places doubles et les mêmes spectateurs que la démo : la première salle est racontée, la deuxième sert à la transformation finale.
- Les chiffres écrits dans le texte de `fr.html` et de `en.html` (places, écran, pente, légende de la coupe) se modifient à la main. `npm test` signale ceux qui ne correspondent plus au JSON de la première salle. Le nom et la description d'une salle viennent, pour chaque langue, du champ `traductions` de son JSON ; les nombres s'écrivent comme la langue de la page (« 9,40 », « 9.40 »).
- Ce que les scripts écrivent eux-mêmes (« Copié », une étiquette de la coupe, les libellés de la démo) passe par `t({ en: 'Copied', fr: 'Copié' })` de `src/lib/langue.ts`, qui lit la langue de la page sur sa balise `<html lang>`. L'anglais s'écrit d'abord : c'est lui qui s'affiche quand un texte manque dans la langue de la page.
- `src/landing/main.ts` porte le reste : liens vers la démo, QR code, carrousel des chiffres et copie de l'adresse de contact. L'adresse elle-même est dans `src/pages/societe.json`.
- Sur écran tactile, la section « Démo » n'affiche pas de QR code, seulement le bouton. Sans WebGL, la scène est retirée et la page reste lisible.
- Le fauteuil géant de l'ouverture est décrit dans `scene.js` (fonctions `seatBack`, `seatCushion`, `seatArm`, `seatFrame`) : dossier, assise, accoudoirs à porte-gobelet, flancs. La coupe de la Fig. 1 se redessine à la largeur disponible, pour tenir en entier sur un téléphone.

### Ce qui se charge, et quand

- **Présentation** : le texte s'affiche avec la page. La scène 3D et three.js sont annoncés dès le HTML (plugin `preloadLandingScene` de `vite.config.ts`) et téléchargés en même temps que le reste, sans bloquer l'affichage. Le générateur de QR code n'est chargé que là où le code s'affiche.
- **Démo** : le premier affichage ne charge que React et l'écran de réservation. Arrivent ensuite, à part : le moteur d'animation (`src/lib/motionFeatures.ts`, via `LazyMotion`), les bandeaux d'information (`src/lib/notify.ts`), le panneau de démo sur ordinateur, puis la vue 3D dès qu'un fauteuil est sélectionné.
- Les polices du premier écran sont préchargées dans les pages de présentation et de démo de chaque langue. Dans les composants de la démo, utiliser `m.div` (import `motion/react-m`) et non `motion.div` : `LazyMotion` est en mode strict et le signale.

## Pages légales et blog

Ce sont des fichiers HTML sans script, dans le dossier de leur langue : les pages légales (`fr/mentions-legales.html`, `fr/confidentialite.html`, `fr/cgu.html`, `fr/cgv.html`, `fr/sla.html`, `fr/dpa.html` ; en anglais `en/legal-notice.html`, `en/privacy.html`, `en/terms-of-use.html`, `en/terms-of-sale.html`, `en/sla.html`, `en/dpa.html`), le blog (`fr/blog.html`, `en/blog.html`) et ses articles (`fr/blog/`, `en/blog/`). À la construction comme en développement, `tools/pages.ts` y remplace :

| Dans la page | Par |
| --- | --- |
| `<!--@include head-->`, `header`, `footer`, `avis` | le morceau du même nom, dans `src/pages/partials/`. Le pied de page est aussi celui de la présentation |
| `{{contact}}`, `{{societe.siege}}`, `{{version}}`… | les valeurs de `src/pages/societe.json`. Une valeur à `null` s'affiche « À compléter » |
| `<!--@sommaire-->` | un lien par section de la page (`<h2 id="…">`) |
| `<!--@articles enquete \| texte si vide-->` | les articles de cette rubrique, les plus récents d'abord (dans `blog.html`) : le premier, le début du suivant grisé, et un bouton qui déplie le reste (une case à cocher, sans script) |
| `<!--@voir-aussi-->` | au bas d'un article : les trois autres articles les plus récents de sa langue |
| `<!--@faq-->` … `<!--@/faq-->` | rien dans la page ; les questions (`data-q`) et les réponses (`data-a`) qu'ils encadrent passent dans les données structurées |
| `<!--@langues-->`, `<!--@langues court-->` | les liens de langue : un par autre langue, vers la même page dans cette langue ; à défaut, vers sa présentation. Par son nom (« English ») dans le pied de page, par son code (« EN ») dans l'en-tête |

Un morceau commun existe par langue (`header.fr.html`, `header.en.html`, `footer.…`, `avis.…`) ; `head.html` vaut pour toutes. Les dates, les rubriques, le sommaire et « À compléter » s'écrivent dans la langue de la page. Une mention de `societe.json` qui se traduit (la forme de la société) s'y écrit par langue : `{ "fr": "…", "en": "…" }`.

- **La société est en cours de formation** : ce que `societe.json` ne dit pas encore (siège, capital, RCS, TVA, directeur de la publication, téléphones) est à renseigner avant de publier. `npm run build` le rappelle.
- **Un article** dit lui-même, dans son en-tête, sa rubrique (`vv:rubrique` : `enquete`, `guide`, `article`, `etude-de-cas`), sa date (`vv:date`), son temps de lecture (`vv:lecture`) et sa clé (`vv:page`, la même dans chaque langue : c'est elle qui relie un article à ses traductions) ; son résumé est sa description. Le copier, changer ces valeurs : il apparaît dans le blog. Modifié après coup, il dit quand (`vv:maj`).
- **Un article daté d'un jour à venir est programmé** : le site construit l'ignore jusqu'à ce jour (à Paris) ; en développement, il se voit, marqué « À paraître ». Chaque matin, `.github/workflows/publication.yml` reconstruit le site s'il y a un article du jour (secret `VERCEL_DEPLOY_HOOK`), puis l'annonce par IndexNow. `VV_JOUR=2026-11-25 npm run build` construit le site d'un jour donné.
- **Chaque article existe dans chaque langue** (`fr/blog/`, `en/blog/`), sous un nom de fichier écrit dans sa langue. `npm test` refuse un article sans traduction.
- **Les pages légales anglaises sont des traductions de courtoisie** : chacune le dit en tête, et renvoie au texte français, qui seul fait foi. Un changement du texte français se reporte dans la traduction.
- **Une page nouvelle** a besoin de sa règle dans `vercel.json`, sans quoi elle répond 404 en ligne. `npm test` le vérifie, comme il vérifie qu'aucun lien ne mène nulle part.
- **Aucun script écrit dans une page** : la politique de contenu de `vercel.json` ne laisse passer que des fichiers.
- La charte commune à ces pages et à la présentation (couleurs, polices, bouton, pied de page) est dans `src/styles/commun.css` ; leur mise en page propre dans `src/pages/pages.css`.

## Langues

Le site est en anglais et en français. **Chaque langue vit sous son préfixe, et il n'y a rien à la racine** :

| Adresse | Fichier |
| --- | --- |
| `/en`, `/fr` | `en.html`, `fr.html` : la présentation |
| `/en/demo`, `/fr/demo` | `en/demo.html`, `fr/demo.html` |
| `/en/blog`, `/fr/blog` | `en/blog.html`, `fr/blog.html` |
| `/en/blog/<article>`, `/fr/blog/<article>` | `en/blog/*.html`, `fr/blog/*.html` : le nom du fichier est écrit dans sa langue |
| `/en/legal-notice`, `/fr/mentions-legales`… | les pages légales, dans le dossier de leur langue |
| `/` | une redirection permanente (308) vers `/en`, la langue par défaut |

- **Une adresse par langue et par page.** Chaque page est sa propre adresse canonique. Deux pages sont la même, dans deux langues, quand elles ont la même **clé** : leur chemin dans leur langue (`blog`, `demo`, `sla`), ou `<meta name="vv:page" content="…">` quand le nom du fichier change avec la langue (un article ; `mentions-legales` et `legal-notice`).
- **Tous les liens d'une page restent dans sa langue**, et mènent droit à la page : aucun ne passe par une redirection. Seul le lien de langue (dans l'en-tête et le pied de page) en sort. `npm test` le vérifie.
- **`/` redirige vers `/en` pour tout le monde.** Rien ne dépend de l'adresse IP, de la langue du navigateur ou d'un cookie : un robot, qui explore surtout depuis les États-Unis, ne verrait qu'une langue.
- **Les anciennes adresses**, du temps où le français était à la racine (`/blog`, `/blog/<article>`, `/demo`, les six pages légales, et `/?demo`, la toute première adresse de la démo), redirigent en 308 vers la même page sous `/fr`. Elles sont dans `vercel.json`, avec les trois règles de réécriture qui servent chaque adresse sans « .html » (`/:langue`, `/:langue/:page`, `/:langue/blog/:article`).
- **Une adresse terminée par « / »** (`/fr/`) mène, en 308, à la même sans barre (`trailingSlash` dans `vercel.json`).
- **`npm run dev` et `npm run preview` servent les mêmes adresses que Vercel** : `tools/routes.ts` leur applique les redirections et les réécritures de `vercel.json`. Ce qu'ils ne peuvent pas éprouver, c'est Vercel lui-même : après une mise en ligne qui touche aux adresses, les vérifier en ligne (`widget/dossier/procedures.md`).
- **Une page sans traduction** est permise (hors présentation, blog, démo et articles, que `npm test` exige dans chaque langue) : elle n'a pas de `hreflang`, et son lien de langue mène à la présentation de l'autre langue. Aujourd'hui, aucune page n'est dans ce cas.

### Ajouter une langue

Une langue se déclare **à un seul endroit** : `LANGUES`, dans `tools/pages.ts` (son nom, son code, ses formats de date, les libellés que l'outil écrit lui-même). La première déclarée est la langue par défaut. Rien d'autre ne la nomme dans le code : ni `vercel.json` (ses règles valent pour tout préfixe), ni les scripts (ils lisent la langue de la page), ni le plan du site, ni `llms.txt`.

Le reste est du contenu, que `npm test` réclame tant qu'il manque. Pour l'espagnol :

1. `es: { … }` dans `LANGUES`.
2. `src/pages/partials/header.es.html` et `footer.es.html` (et `avis.es.html` si les pages légales sont traduites).
3. `es.html`, `es/blog.html`, `es/demo.html`, et un article `es/blog/*.html` par article existant, avec la même clé `vv:page`.
4. Les phrases de sa présentation dans `PHRASES` (`src/landing/halls.test.ts`), pour que ses chiffres soient vérifiés.
5. Ce qui se traduit dans les données : `traductions.es` dans les salles (`src/data/rooms/*.json`), `es` dans `statut` (`src/pages/societe.json`).
6. Au fil de l'eau : les textes des scripts, `t({ en: '…', fr: '…', es: '…' })`. Tant qu'un texte manque, c'est l'anglais qui s'affiche.

## Référencement

Le site est fait pour être trouvé, par un moteur de recherche comme par un assistant (ChatGPT, Claude, Perplexity). Presque tout est posé par `tools/pages.ts`, à la construction :

| Quoi | Où |
| --- | --- |
| Adresse canonique (celle de la page, jamais celle de sa traduction), `og:url`, `og:type`, `og:locale` | dans l'en-tête de chaque page |
| Traductions (`hreflang`) : une ligne par langue où la page existe, et `x-default` vers la langue par défaut | dans l'en-tête de chaque page traduite, et les mêmes dans `sitemap.xml` |
| Données structurées (schema.org) : l'éditeur et le produit sur la présentation, `BlogPosting` et fil d'Ariane sur un article, `FAQPage` là où il y a des questions | dans l'en-tête, en JSON-LD |
| `sitemap.xml` | écrit dans `dist/` : toutes les pages, sauf celles qui se déclarent `noindex` |
| `llms.txt` | écrit dans `dist/` : le résumé du site pour un assistant. Son début est `src/pages/llms.md`, la liste des pages est tirée des pages, langue après langue, la langue par défaut d'abord |
| `robots.txt` | `public/robots.txt` : tout est ouvert, et le plan du site y est annoncé |
| IndexNow | `public/<clé>.txt`, la clé du site publiée à sa racine, et `tools/indexnow.ts`, qui annonce les pages changées |

- **Une page se retire des moteurs elle-même**, par `<meta name="robots" content="noindex, follow" />` dans son en-tête : c'est le cas des six pages légales, dans chaque langue, tant que leurs mentions sont « À compléter ». Elle sort alors du plan du site et de `llms.txt`.
- **Le titre et la description** d'une page sont ce qu'un moteur affiche. `npm test` refuse un titre ou une description en double, un titre de plus de 65 caractères, une description de moins de 110 ou de plus de 155 : au-delà, Bing le signale en erreur et Google coupe. Le titre d'un article se passe de « — VisionViewer » (le nom du site s'affiche déjà au-dessus de chaque résultat) ; celui d'une page du produit le garde.
- **Le nom du site** (« VisionViewer ») est déclaré dans les données structurées pour la racine du domaine, `https://visionviewer.net/`, et non pour `/en` : un moteur ne le lit que là. Il porte aussi son écriture en deux mots (`alternateName`), celle que l'on tape. C'est la seule adresse redirigée que le site cite.
- **Une page dit quand elle a changé** (`vv:maj`, une date) : c'est ce que le plan du site donne aux moteurs. À la main, et seulement quand la page change vraiment ; une présentation ou le blog en portent une, comme un article modifié.
- **Les données structurées sont le seul « script » écrit dans une page** : rien ne s'y exécute, la politique de contenu les laisse passer.
- **IndexNow prévient Bing sans attendre son passage** (`npm run indexnow`, après une mise en ligne vérifiée). Bing partage ce qu'il reçoit avec les autres moteurs du protocole ; Google ne l'écoute pas, et lit le plan du site. **La clé n'est pas un secret** : le protocole veut qu'elle soit publiée à la racine du site, c'est ce qui prouve que la demande vient de lui. Le script ne lit que ce qui est en ligne, et refuse d'envoyer tant que la clé n'y est pas.
- **Rien ne mesure l'audience** : le site ne pose ni cookie ni outil de mesure. Ce que les moteurs voient se lit dans la Search Console de Google et dans Bing Webmaster Tools, une fois le site déclaré (voir `widget/dossier/procedures.md`).

## Logo

Le kit du logo est dans `logo/` : toutes les versions en SVG et en PNG, les icônes du site et un guide d'usage (`logo/guide.md`, vue d'ensemble dans `logo/planche.png`). Le site utilise quatre fichiers copiés dans `public/` : `logo.svg` (la version horizontale simplifiée, en blanc), `favicon.svg`, `favicon.ico` et `apple-touch-icon.png`. Pour changer de logo, remplacer ces fichiers.

## Structure

```
en.html, fr.html                la présentation, dans chaque langue (/en, /fr)
en/, fr/                        le reste de chaque langue : demo.html, blog.html, blog/*.html, les pages légales
tools/pages.ts                  les langues (LANGUES), ce que les pages ont en commun, leurs liens de langue et leur référencement
tools/routes.ts                 les redirections et les réécritures de vercel.json, appliquées aussi en développement et sur le site construit
tools/indexnow.ts               l'annonce des pages à Bing (IndexNow) ; sa clé est dans public/<clé>.txt
src/pages/                      la feuille de style des pages, leurs morceaux communs par langue, les mentions de la société, le début de llms.txt
public/robots.txt               ce que les moteurs ont le droit de lire : tout
src/styles/commun.css           la charte commune à la présentation, aux pages légales et au blog
vercel.json                     les redirections (/ et les anciennes adresses), les réécritures, et les en-têtes de sécurité
public/screens/mire.png         image de test, à projeter au besoin (`screenImage`)
public/og-visionviewer.jpg      vignette du lien (messageries, e-mail)
public/logo.svg, favicon.*      logo et icônes du site, tirés de logo/
logo/                           kit du logo et guide d'usage
src/data/rooms/*.json           une salle par fichier
src/lib/room.ts                 schéma JSON + calcul du plan 2D et des positions 3D
src/lib/view.ts                 position des yeux, distance, angle de vision
src/lib/langue.ts               la langue de la page, et les textes que les scripts écrivent dans cette langue
src/lib/links.ts, src/lib/qr.ts adresses de la présentation et de la démo dans la langue de la page, QR code
src/components/                 écran de réservation, plan 2D, sélecteur de salle, panneau de démo (ordinateur)
src/landing/                    page de présentation : styles, scène 3D, coupe, comportements
src/components/seat-view/       vue 3D : interface, salle, fauteuils instanciés, caméra
src/styles/tokens.css           couleurs et typographie : écran de réservation (--c-*) et habillage VisionViewer (--v-*)
```
