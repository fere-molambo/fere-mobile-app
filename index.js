// Point d'entree personnalise : la tache de suivi du livreur doit etre definie
// avant tout rendu. Quand Android relance l'application en arriere-plan pour
// lui livrer une position (livreur qui a ferme l'application en pleine
// course), aucun ecran n'est monte et app/_layout.tsx n'est jamais charge.
import 'react-native-get-random-values';
import './lib/backgroundTracking';
import 'expo-router/entry';
