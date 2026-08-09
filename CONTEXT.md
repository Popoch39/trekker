# Trekker

Application de randonnee : un catalogue d'itineraires consultable depuis un
front web et une app mobile, alimente par des donnees ouvertes et, a terme, par
ses utilisateurs.

## Language

### Itineraires

**Trek**:
Un parcours de randonnee decrit et reutilisable, sans date ni participants.
_Avoid_: Randonnee, rando, sentier, parcours, circuit

**Sortie**:
Une randonnee organisee a une date donnee, par un utilisateur, sur un trek.
Concept distinct du trek et pas encore implemente.
_Avoid_: Evenement, event, trek date

**Trace**:
La geometrie du trek : la suite de positions qui dessine le parcours sur une
carte. Un trek a exactement une trace.
_Avoid_: Geometrie, GPX, ligne, chemin

**Point de depart**:
La position ou commence un trek. Derive de la trace, conserve a part parce que
c'est sur lui que porte la recherche par proximite.
_Avoid_: Depart, origine, start

**Type de parcours**:
La forme du trek : boucle, aller-retour, ou d'un point a un autre.
_Avoid_: Route, forme, format

### Provenance

**Source**:
D'ou vient un trek : importe d'un publicateur de donnees ouvertes, ou cree par
un utilisateur. Determine s'il est modifiable.
_Avoid_: Origine, provider, fournisseur

**Instance source**:
Le publicateur precis dont un trek importe provient. Deux publicateurs
numerotent leurs itineraires independamment : c'est l'instance qui leve
l'ambiguite.
_Avoid_: Portail, serveur, partenaire

**Liste blanche**:
L'ensemble des instances sources dont la licence a ete verifiee et qui peuvent
donc etre importees. Y entrer est un acte explicite.
_Avoid_: Whitelist, sources autorisees

**Licence**:
Les conditions de reutilisation attachees a un trek importe, et l'obligation
d'attribution qui en decoule. Portee par le trek, pas seulement par la base.
_Avoid_: Droits, copyright

### Difficulte

**Difficulte**:
Le niveau d'exigence d'un trek sur l'echelle du projet : facile, moyen,
difficile, tres difficile. Absente quand aucune correspondance fiable n'existe.
_Avoid_: Niveau, cotation

**Difficulte source**:
Le libelle de difficulte tel que publie par l'instance source, conserve tel
quel. Sert a verifier et corriger la correspondance vers la difficulte du
projet.
_Avoid_: Difficulte brute, libelle original
