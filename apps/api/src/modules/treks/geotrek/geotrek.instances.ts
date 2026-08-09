/**
 * Instances Geotrek importees.
 *
 * Liste blanche explicite, et non decouverte automatique : Geotrek est un
 * logiciel libre, mais la licence des donnees est decidee par chaque
 * publicateur. Une instance n'entre ici qu'apres lecture de sa mention de
 * licence, dont l'URL est conservee dans `licenseSourceUrl` — c'est ce qui rend
 * la conformite verifiable dans une revue de code plutot que sur parole.
 *
 * Retirer une instance de cette liste n'efface pas ses treks deja importes :
 * c'est une suppression explicite en base, pas un effet de bord du prochain
 * import.
 */
export interface GeotrekInstance {
  /** Identifiant stable, stocke en base dans `source_instance`. */
  key: string;
  /** Racine de l'API v2, sans slash final. */
  apiBaseUrl: string;
  /** Nom lisible du publicateur, pour l'attribution. */
  publisher: string;
  /** Licence exacte, telle qu'annoncee par le publicateur. */
  license: string;
  /** Ou cette licence a ete constatee. */
  licenseSourceUrl: string;
  /** Site public du publicateur, expose aux clients comme lien de source. */
  portalUrl: string | null;
}

/**
 * Reserve explicite, valable pour les quatre entrees : la licence est publiee
 * sur la fiche data.gouv.fr du jeu de donnees, qui est un export periodique de
 * la meme base Geotrek. Nous consommons l'API plutot que l'export, donc la
 * meme donnee sous une autre forme. Si un doute juridique devait etre leve, la
 * parade est d'ingerer les ressources data.gouv.fr referencees ci-dessous.
 *
 * Instances ecartees, et pourquoi :
 * - Pilat (admin.pilat-rando.fr, 260 treks) : API ouverte, mais aucune mention
 *   de licence trouvee, ni sur le portail ni sur data.gouv.fr.
 * - Vercors : jeu de donnees en Licence Ouverte 2.0, mais aucun hote d'API
 *   resolvable a ce jour.
 * - Vanoise, Mercantour, Pyrenees : pas d'instance publique joignable.
 */
export const GEOTREK_INSTANCES: GeotrekInstance[] = [
  {
    key: 'ecrins',
    apiBaseUrl: 'https://geotrek-admin.ecrins-parcnational.fr/api/v2',
    publisher: 'Parc national des Ecrins',
    license: 'Licence Ouverte / Open Licence 2.0',
    licenseSourceUrl:
      'https://www.data.gouv.fr/datasets/randonnees-du-parc-national-des-ecrins',
    portalUrl: 'https://rando.ecrins-parcnational.fr',
  },
  {
    key: 'cheminsdesparcs',
    apiBaseUrl: 'https://admin.cheminsdesparcs.fr/api/v2',
    publisher: "Parcs naturels regionaux de Provence-Alpes-Cote d'Azur",
    license: 'Licence Ouverte / Open Licence 2.0',
    licenseSourceUrl:
      'https://www.data.gouv.fr/datasets/parcs-naturels-regionaux-itineraires-de-randonnees-a-pied-a-velo-a-vtt-et-a-cheval-publie-dans-chemins-des-parcs',
    portalUrl: 'https://www.cheminsdesparcs.fr',
  },
  {
    key: 'alpes-haute-provence',
    apiBaseUrl: 'https://admin.rando-alpes-haute-provence.fr/api/v2',
    publisher: 'Departement des Alpes-de-Haute-Provence',
    license: 'Licence Ouverte / Open Licence 2.0',
    licenseSourceUrl:
      'https://www.data.gouv.fr/datasets/plan-departemental-des-itineraires-de-promenade-et-de-randonnee-des-alpes-de-haute-provence-1',
    portalUrl: 'https://www.rando-alpes-haute-provence.fr',
  },
  {
    key: 'cevennes',
    // Domaine en .net et non en .fr, contrairement aux autres parcs nationaux.
    apiBaseUrl: 'https://geotrek-admin.cevennes-parcnational.net/api/v2',
    publisher: 'Parc national des Cevennes',
    // La fiche data.gouv.fr annonce la Licence Ouverte sans numero de version,
    // et son champ machine indique la 1.0 : c'est donc la 1.0 qui est retenue,
    // faute de mieux documente.
    license: 'Licence Ouverte / Open Licence 1.0',
    licenseSourceUrl:
      'https://www.data.gouv.fr/datasets/itineraires-de-randonnee-du-parc-national-des-cevennes',
    portalUrl: 'https://destination.cevennes-parcnational.fr',
  },
];

export const findInstance = (key: string): GeotrekInstance | undefined =>
  GEOTREK_INSTANCES.find((instance) => instance.key === key);
