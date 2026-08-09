# Contexte du domaine — trekker

Glossaire du langage du projet. Un terme ici a **un seul** sens, dans le code
comme dans les discussions. Aucun détail d'implémentation : ce fichier décrit ce
dont on parle, pas comment c'est construit.

## Utilisateur

Une personne identifiée par une adresse email unique. C'est l'entité à laquelle
se rattache tout ce qui est produit dans l'application.

Un Utilisateur n'est pas une méthode de connexion : la même personne peut se
connecter de plusieurs façons sans jamais devenir deux Utilisateurs.

## Compte

Le lien entre un Utilisateur et **une** méthode d'authentification — mot de
passe, ou plus tard un fournisseur externe (Google, Apple).

Piège de vocabulaire à ne pas laisser passer : « compte » au sens courant
désigne l'Utilisateur (« mon compte », « supprimer mon compte »). Dans ce
projet, un Compte est strictement un moyen de se connecter. Un Utilisateur a
un ou plusieurs Comptes ; supprimer un Compte ne supprime pas l'Utilisateur.

## Session

Une période pendant laquelle un client donné agit au nom d'un Utilisateur.
Elle expire, et un même Utilisateur peut en avoir plusieurs simultanément — le
web et le mobile en ouvrent chacun une.

La Session appartient au client, pas à l'Utilisateur : se déconnecter du mobile
ne déconnecte pas le web.

## Vérification

Une preuve à durée limitée, adressée à un canal (une adresse email), qu'on
échange contre une action. Sert aujourd'hui au socle technique ; les usages
visibles (confirmation d'adresse, réinitialisation de mot de passe) ne sont pas
encore ouverts.
