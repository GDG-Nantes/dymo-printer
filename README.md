# Dymo Label Printer - Application TypeScript

Cette application TypeScript permet d'imprimer des étiquettes personnalisées sur une imprimante Dymo LabelWriter 550 à partir d'un fichier CSV contenant les informations des participants.

## Prérequis

1. **Node.js** (version 14 ou supérieure)
2. **DYMO Connect** installé sur votre système
3. **Imprimante DYMO LabelWriter 550** connectée et configurée
4. **Service DYMO Web Service** en cours d'exécution

## Installation

1. Clonez ou téléchargez ce projet
2. Installez les dépendances :
```powershell
npm install
```

## Format du fichier CSV

Créez un fichier `participants.csv` avec les colonnes suivantes :
- `nom` : Nom de famille du participant
- `prenom` : Prénom du participant  
- `role` : Rôle du participant (speaker, MC, organisateur)

Exemple :
```csv
nom,prenom,role
Dupont,Jean,speaker
Martin,Marie,organisateur
Durand,Pierre,MC
```

## Utilisation

```powershell
# Compilation et exécution
npm start
```

## Types de rôles supportés

- **speaker** : Étiquette verte pour les intervenants
- **MC** : Étiquette bleue pour les maîtres de cérémonie
- **organisateur** : Étiquette orange pour les organisateurs
- **autre** : Étiquette grise par défaut

## Dépannage

### Service DYMO Web Service non trouvé
- Vérifiez que DYMO Label Software est installé
- Redémarrez le service DYMO Web Service
- L'API fonctionne sur http://127.0.0.1:41951

### Imprimante non détectée
- Vérifiez que l'imprimante est allumée et connectée
- Installez les pilotes DYMO LabelWriter 550
- Testez l'impression depuis DYMO Label Software
