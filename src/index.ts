import * as fs from 'fs';
import csv from 'csv-parser';
import * as path from 'path';
import { DymoAPI } from './dymo-api';
import { Participant } from './types';

export class DymoLabelPrinter {
    private participants: Participant[] = [];
    private dymoAPI: DymoAPI;
    private printerName: string = 'DYMO LabelWriter 550';

    constructor() {
        this.dymoAPI = new DymoAPI();
    }

    // Lire le fichier CSV des participants
    async readCSVFile(filePath: string): Promise<Participant[]> {
        return new Promise((resolve, reject) => {
            const participants: Participant[] = [];

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row: any) => {
                    // Valider les colonnes requises
                    if (row.nom && row.prenom && row.role) {
                        participants.push({
                            nom: row.nom.trim(),
                            prenom: row.prenom.trim(),
                            role: row.role.trim().toLowerCase()
                        });
                    }
                })
                .on('end', () => {
                    console.log(`${participants.length} participants chargés depuis le fichier CSV`);
                    this.participants = participants;
                    resolve(participants);
                })
                .on('error', (error: Error) => {
                    reject(error);
                });
        });
    }

    // Générer le contenu XML pour l'étiquette Dymo
    private generateLabelXML(participant: Participant): string {
        const { nom, prenom, role } = participant;
        const fullName = `${prenom} ${nom}`;

        // Déterminer l'affichage du rôle
        let roleDisplay = '';
        switch (role) {
            case 'speaker':
                roleDisplay = 'SPEAKER';
                break;
            case 'mc':
                roleDisplay = 'MC';
                break;
            case 'organisateur':
                roleDisplay = 'ORGANISATEUR';
                break;
            default:
                roleDisplay = 'PARTICIPANT';
        }

        // Template XML avec nom en gros en haut à gauche et rôle en petit en bas
        return `<DieCutLabel Version="8.0" Units="twips">
    <PaperOrientation>Landscape</PaperOrientation>
    <Id>Address</Id>
    <PaperName>30252 Address</PaperName>
    <DrawCommands/>
    <ObjectInfo>
        <TextObject>
            <Name>NAME</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
            <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
            <LinkedObjectName/>
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>True</IsVariable>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Top</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String>${fullName}</String>
                    <Attributes>
                        <Font Family="Arial" Size="14" Bold="True" Italic="False" Underline="False" Strikeout="False"/>
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="150" Y="150" Width="3000" Height="400"/>
    </ObjectInfo>
    <ObjectInfo>
        <TextObject>
            <Name>ROLE</Name>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
            <BackColor Alpha="0" Red="255" Green="255" Blue="255"/>
            <LinkedObjectName/>
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>True</IsVariable>
            <HorizontalAlignment>Left</HorizontalAlignment>
            <VerticalAlignment>Bottom</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
                <Element>
                    <String>${roleDisplay}</String>
                    <Attributes>
                        <Font Family="Arial" Size="8" Bold="False" Italic="False" Underline="False" Strikeout="False"/>
                        <ForeColor Alpha="255" Red="0" Green="0" Blue="0"/>
                    </Attributes>
                </Element>
            </StyledText>
        </TextObject>
        <Bounds X="150" Y="600" Width="3000" Height="250"/>
    </ObjectInfo>
</DieCutLabel>`;
    }

    // Imprimer une étiquette via l'API Dymo réelle
    async printLabel(participant: Participant): Promise<boolean> {
        try {
            const labelXML = this.generateLabelXML(participant);

            // Sauvegarder le XML généré
            const outputDir = path.join(process.cwd(), 'generated-labels');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            const fileName = `${participant.prenom}_${participant.nom}_${participant.role}.xml`;
            const filePath = path.join(outputDir, fileName);
            fs.writeFileSync(filePath, labelXML);

            // Imprimer via l'API Dymo
            const printSuccess = await this.dymoAPI.printLabel(this.printerName, labelXML);

            if (printSuccess) {
                console.log(`✅ Étiquette imprimée pour ${participant.prenom} ${participant.nom} (${participant.role})`);
                return true;
            } else {
                console.log(`⚠️  Étiquette générée mais non imprimée pour ${participant.prenom} ${participant.nom} (${participant.role})`);
                return false;
            }

        } catch (error) {
            console.error(`❌ Erreur lors de l'impression pour ${participant.prenom} ${participant.nom}:`, (error as Error).message);
            return false;
        }
    }

    // Imprimer toutes les étiquettes
    async printAllLabels(): Promise<void> {
        console.log(`Début de l'impression de ${this.participants.length} étiquettes...`);

        let successCount = 0;
        let errorCount = 0;

        for (const participant of this.participants) {
            const success = await this.printLabel(participant);
            if (success) {
                successCount++;
            } else {
                errorCount++;
            }

            // Petite pause entre chaque impression
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\nRésultat de l'impression:`);
        console.log(`✅ Succès: ${successCount}`);
        console.log(`❌ Erreurs: ${errorCount}`);
        console.log(`📄 Total: ${this.participants.length}`);
    }

    // Vérifier si l'imprimante Dymo est disponible
    async checkPrinter(): Promise<boolean> {
        try {
            console.log('🔍 Vérification de la disponibilité du service DYMO...');

            // Vérifier si le service DYMO est en marche
            const serviceAvailable = await this.dymoAPI.isServiceAvailable();
            if (!serviceAvailable) {
                console.log('❌ Service DYMO Web Service non disponible');
                console.log('ℹ️  Assurez-vous que DYMO Label Software est installé et en cours d\'exécution');
                return false;
            }

            console.log('✅ Service DYMO détecté');

            // Obtenir la liste des imprimantes
            const printers = await this.dymoAPI.getPrinters();
            console.log(`📄 ${printers.length} imprimante(s) DYMO détectée(s):`);

            printers.forEach((printer, index) => {
                console.log(`   ${index + 1}. ${printer.name} (${printer.model})`);
            });

            // Vérifier si une imprimante DYMO LabelWriter est disponible
            const targetPrinter = printers.find(p =>
                p.name.toLowerCase().includes('dymo labelwriter')
            );

            if (!targetPrinter) {
                console.log(`⚠️  Aucune imprimante DYMO LabelWriter trouvée`);
                if (printers.length > 0) {
                    console.log(`ℹ️  Utilisation de la première imprimante disponible: ${printers[0].name}`);
                    this.printerName = printers[0].name;
                    return true;
                }
                return false;
            }

            console.log(`✅ Imprimante DYMO LabelWriter trouvée: ${targetPrinter.name}`);

            return true;

        } catch (error) {
            console.error('❌ Erreur lors de la vérification de l\'imprimante:', (error as Error).message);
            console.log('ℹ️  Mode fallback: génération des fichiers XML uniquement');
            return false;
        }
    }

    // Getter pour les participants (pour l'export)
    get participantsList(): Participant[] {
        return this.participants;
    }
}

// Fonction principale
async function main(): Promise<void> {
    const printer = new DymoLabelPrinter();

    try {
        // Vérifier l'imprimante
        const printerAvailable = await printer.checkPrinter();
        if (!printerAvailable) {
            console.error('Imprimante non disponible');
            return;
        }

        // Chemin du fichier CSV (à ajuster selon vos besoins)
        const csvFilePath = path.join(process.cwd(), 'participants.csv');

        // Vérifier si le fichier CSV existe
        if (!fs.existsSync(csvFilePath)) {
            console.error(`❌ Fichier CSV non trouvé: ${csvFilePath}`);
            console.log('📝 Créez un fichier participants.csv avec les colonnes: nom,prenom,role');
            return;
        }

        // Lire le fichier CSV
        await printer.readCSVFile(csvFilePath);

        if (printer.participantsList.length === 0) {
            console.log('❌ Aucun participant trouvé dans le fichier CSV');
            return;
        }

        // Afficher un aperçu des participants
        console.log('\n📋 Participants à imprimer:');
        printer.participantsList.forEach((p, index) => {
            console.log(`${index + 1}. ${p.prenom} ${p.nom} - ${p.role.toUpperCase()}`);
        });

        console.log('\n🖨️  Démarrage de l\'impression...');

        // Imprimer toutes les étiquettes
        await printer.printAllLabels();

    } catch (error) {
        console.error('❌ Erreur dans l\'application:', (error as Error).message);
    }
}

// Démarrer l'application si ce fichier est exécuté directement
if (require.main === module) {
    main().catch(console.error);
}
