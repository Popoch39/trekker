# Sources de donnees et attribution des licences

Le catalogue est peuple depuis l'API v2 d'instances **Geotrek** (le logiciel de
gestion d'itineraires utilise par une centaine de parcs et departements
francais), et non depuis OpenStreetMap, parce que Geotrek publie des
itineraires _finis_ — difficulte, denivele, duree, description — la ou OSM ne
fournit que des geometries : importer OSM aurait rempli la table de colonnes
nulles et impose de calculer le denivele depuis un modele d'elevation, un
chantier a lui seul.

La contrepartie est que Geotrek est un logiciel libre dont **la licence des
donnees est decidee par chaque publicateur**. Les instances importees forment
donc une liste blanche explicite
(`apps/api/src/modules/treks/geotrek/geotrek.instances.ts`), chacune portant sa
licence et l'URL ou celle-ci a ete constatee — ce qui rend la conformite
verifiable dans une revue de code. Une instance dont la licence n'a pas ete
trouvee n'est pas importee, meme si son API repond : c'est le cas de Pilat, ecarte
explicitement.

La licence et le lien vers la source sont stockes **par trek** et exposes dans
le contrat public : la Licence Ouverte, comme ODbL et CC-BY, impose de crediter,
ce qu'un client ne peut faire que s'il sait quoi afficher pour chaque
itineraire.

## Alternatives ecartees

- **OpenStreetMap** : couverture nationale et licence ODbL unique, mais ni
  difficulte, ni denivele, ni duree, ni description. Reste le bon complement de
  couverture le jour ou la geometrie seule suffira.
- **AllTrails, Wikiloc, Visorando** : conditions d'utilisation interdisant
  l'extraction. Inexploitables, quel que soit le moyen technique.
- **Outdooractive** : API documentee mais commerciale, sous licence payante.
  Envisageable comme accord de contenu, pas comme source de peuplement.
- **Les photos** des instances Geotrek : elles portent des credits par auteur,
  distincts de la licence du jeu de donnees. Elles ne sont pas importees, ce qui
  supprime le point le plus epineux du sujet.

## Consequence non evidente

Le champ `cirkwi_level` de l'API Geotrek ressemble a une echelle de difficulte
normalisee de 1 a 5, mais il est configure par chaque instance : releve en aout
2026, le libelle « Facile » vaut 3 aux Ecrins, aux Cevennes et sur Chemins des
Parcs, et 2 dans les Alpes-de-Haute-Provence. S'y fier traduisait « Facile » en
« moyen ». La correspondance porte donc sur les libelles, identiques d'un
publicateur a l'autre, et le libelle d'origine est conserve dans
`source_difficulty` pour que la traduction reste verifiable.
