# PostGIS pour les traces d'itineraires

Les traces de randonnee sont stockees en colonnes PostGIS
(`geometry(linestring,4326)` pour la trace, `geometry(point,4326)` pour le point
de depart) plutot qu'en `jsonb`, afin que la recherche par proximite
(« les treks a moins de 30 km d'ici ») se fasse en SQL sur un index GiST plutot
qu'en memoire cote application. Le prix est reel et se paie une fois : l'image
Postgres passe a `postgis/postgis`, ce qui impose de recreer le volume de
donnees, et l'image des tests Testcontainers doit suivre.

## Consequences non evidentes

Le `geometry()` de `drizzle-orm` 0.45 **n'est pas utilisable** : sa
configuration `type` / `srid` est acceptee par TypeScript mais ignoree a
l'execution — la colonne emise est toujours `geometry(point)` — et son decodeur
leve `Unsupported geometry type` a la lecture d'un LineString. Les deux colonnes
passent donc par un `customType` maison (`packages/db/src/columns.ts`).

Le point de depart est declare en `geometry` et non en `geography`, alors que
`geography` serait plus naturel pour raisonner en metres : drizzle-kit ne
connait comme type natif que `geometry(...)` et citerait
`"geography(point,4326)"` comme un type utilisateur, produisant un SQL invalide
a chaque generation. Les requetes de proximite castent donc explicitement en
`::geography`, et l'index GiST porte sur cette meme expression pour rester
utilisable.

`drizzle-kit` n'emet jamais de `CREATE EXTENSION` : la ligne est ajoutee a la
main en tete de la migration `0001`. C'est la seule entorse a la regle « le SQL
genere n'est pas modifie », et elle est idempotente.

## Tri par proximite

Le tri par distance s'ecrit avec l'operateur `<->` et non avec `ST_Distance` :
seul le premier autorise le parcours KNN de l'index GiST, qui rend les lignes
deja ordonnees au lieu de trier tout le rayon. Le depart par `id` qui suit ne
l'empeche pas — Postgres coiffe alors le parcours d'un `Incremental Sort`.

A retenir avant d'en attendre un gain immediat : **le planner ne choisit pas ce
plan aujourd'hui**. Sur environ 2 400 itineraires il prefere un `Bitmap Heap
Scan` suivi d'un tri, parce qu'il estime a une seule ligne le resultat d'un
`ST_DWithin` qui en rend 739 — la mauvaise selectivite des predicats PostGIS
est connue. Les deux plans sont estimes a 12 % l'un de l'autre, alors que le
plan KNN, force par `enable_bitmapscan = off`, lit 21 lignes au lieu de 979 et
s'execute en ~18 ms contre ~25 ms.

L'ecriture avec `<->` ne coute donc rien et rend le bon plan atteignable des que
la table grossira assez pour que le cout du parcours bitmap depasse celui du
parcours indexe. Avec `ST_Distance`, ce plan n'existait tout simplement pas.

## Index sur la trace

`treks_geometry_idx` porte sur `(geometry::geography)`, meme forme que l'index
du point de depart. Il sert les recherches qui portent sur le parcours entier
(`matchOn=trace`) et les cadres de carte. Un seul index plutot que deux : les
fonctions `ST_Intersects` et `ST_DWithin` acceptent des arguments `geography`,
donc la recherche par cadre passe par le meme index que la recherche en metres.

Le cout est reel : l'index est nettement plus gros que celui des points, et le
calcul exact qui suit le filtre d'index l'est aussi sur une trace de cent
cinquante points. C'est le prix d'une question qu'un index sur le seul depart
ne peut pas satisfaire.

Enfin, les colonnes geographiques ne sont jamais selectionnees telles quelles —
le driver les rendrait en EWKB hexadecimal. Toute lecture passe par
`ST_AsGeoJSON(...)::json`, le cast `::json` etant ce qui fait rendre un objet
deja analyse plutot qu'une chaine.
