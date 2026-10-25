// Textes de l'interface en français et en anglais. Module pur, sans accès au DOM.

const DEFAULT_LANG = 'fr';

export const TEXTS = {
  fr: {
    elle: 'Elle', lui: 'Lui', tous: 'Tous',
    homeTitle: 'Quel parfum aimez\u2011vous\u00A0?',
    homeLead: 'Dites-nous votre parfum préféré : nous vous donnons le numéro de notre version qui l’évoque.',
    homeHint: 'Vous préférez parcourir ? Touchez Elle ou Lui sur l’affiche.',
    placeholder: 'Ex. Sauvage, J’adore, Chanel…',
    searchLabel: 'Rechercher un parfum ou une marque',
    count: n => `${n} parfums`,
    back: 'Accueil',
    clear: 'Effacer la recherche',
    allBrands: 'Toutes les marques',
    titleFemme: 'Parfums femme', titleHomme: 'Parfums homme', titleTous: 'Tous les parfums',
    titleSearch: q => `« ${q} »`,
    found: n => n === 1 ? '1 parfum trouvé' : `${n} parfums trouvés`,
    foundElsewhere: (univ, n) => `Rien dans « ${univ} », voici ${n === 1 ? 'le résultat' : `les ${n} résultats`} dans toute la collection`,
    empty: q => `Aucun parfum ne correspond à « ${q} ». Vérifiez l’orthographe ou cherchez la marque.`,
    evoque: 'Évoque',
    univFemme: 'Parfum femme', univHomme: 'Parfum homme',
    ticketKicker: 'Notre version',
    ticketHint: 'Montrez ce ticket à un conseiller, il vous guidera en rayon.',
    close: 'Fermer',
    idle: s => `Retour à l’accueil dans ${s} s`,
    continue: 'Continuer',
    langSwitch: 'EN', langLabel: 'Switch to English',
    offline: 'Données de secours utilisées',
    unavailable: 'La collection est momentanément indisponible. Demandez à un conseiller.',
    loading: 'Chargement…',
    collectionLabel: 'Collection', railLabel: 'Filtrer par', filtersLabel: 'Filtres',
    ticketLabel: (n, nom) => `Notre version n°${n}, évoque ${nom}`,
    byBrand: 'Par marque', byFamily: 'Par famille', allFamilies: 'Toutes les familles',
    notesTitle: 'Notes du parfum original',
    tete: 'Tête', coeur: 'Cœur', fond: 'Fond',
    familles: {
      'Hespéridé': 'Agrumes', 'Aquatique': 'Frais et marin', 'Aromatique': 'Aromatique',
      'Floral': 'Floral', 'Chypré': 'Chypré', 'Boisé': 'Boisé', 'Ambré': 'Ambré et oriental',
      'Gourmand': 'Gourmand', 'Cuir': 'Cuir', 'Musqué': 'Musqué',
    },
  },
  en: {
    elle: 'Her', lui: 'Him', tous: 'All',
    homeTitle: 'Which fragrance do you love?',
    homeLead: 'Tell us your favourite fragrance and we’ll give you the number of our version inspired by it.',
    homeHint: 'Rather browse? Tap Her or Him on the poster.',
    placeholder: 'E.g. Sauvage, J’adore, Chanel…',
    searchLabel: 'Search a fragrance or a brand',
    count: n => `${n} fragrances`,
    back: 'Home',
    clear: 'Clear search',
    allBrands: 'All brands',
    titleFemme: 'For her', titleHomme: 'For him', titleTous: 'All fragrances',
    titleSearch: q => `“${q}”`,
    found: n => n === 1 ? '1 fragrance found' : `${n} fragrances found`,
    foundElsewhere: (univ, n) => `Nothing in “${univ}”, here ${n === 1 ? 'is the result' : `are the ${n} results`} from the whole collection`,
    empty: q => `No fragrance matches “${q}”. Check the spelling or search for the brand.`,
    evoque: 'Inspired by',
    univFemme: 'For her', univHomme: 'For him',
    ticketKicker: 'Our version',
    ticketHint: 'Show this ticket to a sales associate, they’ll find it for you.',
    close: 'Close',
    idle: s => `Back to home in ${s} s`,
    continue: 'Keep browsing',
    langSwitch: 'FR', langLabel: 'Passer en français',
    offline: 'Using backup data',
    unavailable: 'The collection is temporarily unavailable. Please ask a sales associate.',
    loading: 'Loading…',
    collectionLabel: 'Collection', railLabel: 'Filter by', filtersLabel: 'Filters',
    ticketLabel: (n, nom) => `Our version no. ${n}, inspired by ${nom}`,
    byBrand: 'By brand', byFamily: 'By scent', allFamilies: 'All scents',
    notesTitle: 'Notes of the original',
    tete: 'Top', coeur: 'Heart', fond: 'Base',
    familles: {
      'Hespéridé': 'Citrus', 'Aquatique': 'Fresh and aquatic', 'Aromatique': 'Aromatic',
      'Floral': 'Floral', 'Chypré': 'Chypre', 'Boisé': 'Woody', 'Ambré': 'Amber and oriental',
      'Gourmand': 'Gourmand', 'Cuir': 'Leather', 'Musqué': 'Musky',
    },
  },
};

/**
* Renvoie la valeur brute (chaîne, fonction ou objet) d'un texte.
* Langue inconnue : français. Clé inconnue : la clé elle-même, pour
* qu'une traduction manquante se voie à l'écran au lieu de planter.
*/
export function translate(lang, key) {
 const texts = TEXTS[lang] ?? TEXTS[DEFAULT_LANG];
 return key in texts ? texts[key] : key;
}
