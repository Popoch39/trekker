# Jeu de donnees livre

`treks.fixture.json` est ce que `pnpm seed` insere quand aucun fichier n'est
passe en argument. Il permet a un poste neuf — ou a l'image Docker — d'avoir un
catalogue non vide sans acces reseau.

## Ce que c'est

100 itineraires, 25 par instance de la liste blanche
(`src/modules/treks/geotrek/geotrek.instances.ts`), produits par
`pnpm import:treks` puis echantillonnes.

**Les traces sont simplifiees** : au plus 150 points par itineraire, en
conservant toujours le premier et le dernier. Sans cela le fichier passerait de
900 Ko a une dizaine de megaoctets, et un depot ne se debarrasse pas d'un blob.
Le trace reste fidele a l'echelle d'un ecran, mais ce n'est pas la donnee
d'origine : pour un environnement reel, seeder depuis le jeu complet.

## Regenerer

```sh
pnpm import:treks              # reseau -> apps/api/data/treks.json (~200 Mo, non versionne)
pnpm seed data/treks.json      # jeu complet en base
```

Le fichier complet n'est volontairement pas versionne. Rafraichir la fixture
est un acte explicite, dont le resultat doit se relire dans un diff.

## Piege

`pnpm seed` **sans argument** rejoue la fixture, donc ses traces simplifiees.
Lance sur une base deja peuplee par le jeu complet, il degrade les 100
itineraires concernes : l'upsert fait exactement son travail, mais avec une
donnee moins precise. Sur un environnement seede depuis le jeu complet, toujours
repasser le chemin :

```sh
pnpm --filter api seed data/treks.json
```
