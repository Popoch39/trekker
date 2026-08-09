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

Enfin, les colonnes geographiques ne sont jamais selectionnees telles quelles —
le driver les rendrait en EWKB hexadecimal. Toute lecture passe par
`ST_AsGeoJSON(...)::json`, le cast `::json` etant ce qui fait rendre un objet
deja analyse plutot qu'une chaine.
