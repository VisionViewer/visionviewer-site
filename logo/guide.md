# VisionViewer — guide du logo

Vue d'ensemble : [planche.png](planche.png).

## 1. Le logo

- **Idée** : le plan d'une salle en points, avec une place mise en lumière. La taille des points décroît autour de la place choisie.
- **Couleur** : une seule. Blanc sur fond sombre, noir sur fond clair. Pas de vert ni de rouge dans le logo.
- **Versions** :

| Fichier | Usage |
| --- | --- |
| `logo-horizontal.svg` | version principale, symbole et nom côte à côte |
| `logo-empile.svg` | symbole au-dessus du nom, pour un format carré ou vertical |
| `symbole.svg` | symbole seul (25 points), à partir de 48 px |
| `nom.svg` | nom seul, quand le symbole est déjà présent à côté |
| `logo-horizontal-petit.svg`, `symbole-petit.svg` | dessin simplifié à 16 points, pour les petites tailles |
| `icone.svg` | symbole sur une tuile noire arrondie : icône d'application, avatar |
| `web/` | favicon (`favicon.svg`, `favicon.ico`) et icônes pour téléphone |
| `png/` | les mêmes en image, pour les outils qui ne lisent pas le SVG |

Chaque fichier existe en noir (pour fond clair) et en `-blanc` (pour fond sombre). Dans les versions blanches, les points sont réduits de 3 % : une forme claire sur fond sombre paraît plus grosse.

## 2. Espace libre

Laisser autour du logo un espace vide égal au **diamètre du gros point** du symbole. Cet espace grandit et rétrécit avec le logo.

## 3. Tailles minimales

| Version | Écran | Impression |
| --- | --- | --- |
| Horizontal | 160 px de large | 40 mm de large |
| Empilé | 200 px de large | 50 mm de large |
| Horizontal, dessin simplifié | 80 px de large | 20 mm de large |
| Symbole | 48 px | 12 mm |
| Symbole, dessin simplifié | 16 px (fichier `web/favicon.svg`) | 6 mm |

En dessous de 48 px de haut pour le symbole, toujours prendre le dessin simplifié : les petits points du dessin principal disparaissent.

## 4. Couleurs

| Nom | HEX | RVB | CMJN (indicatif) |
| --- | --- | --- | --- |
| Noir VisionViewer | `#040405` | 4, 4, 5 | 0, 0, 0, 100 |
| Blanc VisionViewer | `#F5F5F6` | 245, 245, 246 | 0, 0, 0, 4 |

Ce sont le fond et le texte du site. Les valeurs CMJN sont à valider avec l'imprimeur.

**Associations permises** : blanc sur noir, noir sur blanc, blanc sur une photo sombre et calme. Sur une image chargée, utiliser `icone.svg`, qui apporte son propre fond.

## 5. Typographie

- **Nom du logo** : Inter Tight Regular, interlettrage resserré de 1,5 %. Dans les fichiers, le nom est converti en tracés : aucune police à installer.
- **Site** : Inter Tight Light pour les titres, Geist Mono pour les libellés.
- **Licence** : Inter Tight est sous licence libre SIL Open Font License, qui autorise l'usage en logo.

## 6. À ne pas faire

Ne pas étirer ni écraser · ne pas changer les couleurs · ne pas colorer un point · ne pas faire pivoter · ne pas ajouter d'ombre, de contour ou de dégradé · ne pas rapprocher ni redimensionner le symbole et le nom l'un par rapport à l'autre · ne pas retaper le nom dans une autre police · ne pas utiliser le dessin principal en dessous de 48 px.

## 7. À savoir

- Le dépôt du nom et du logo n'a pas été vérifié : une recherche d'antériorité reste à faire avant tout dépôt de marque.
- Les pistes écartées (cône, nuage, versions avec vert) sont dans `recherches/`.
- Dans le site, le logo affiché est `public/logo.svg` (copie de `logo-horizontal-petit-blanc.svg`) et les icônes viennent de `web/`.
