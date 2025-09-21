import * as https from 'https';
import * as querystring from 'querystring';
import { PrinterInfo, PrinterStatus } from './types';

export class DymoAPI {
    private baseUrl: string = 'https://127.0.0.1:41951/DYMO/DLS';
    private timeout: number = 5000;
    private httpsAgent: https.Agent;

    constructor() {
        // Agent HTTPS qui ignore les certificats auto-signés (nécessaire pour l'API Dymo locale)
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
    }

    // Vérifier si le service DYMO est disponible
    async isServiceAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            const options = {
                hostname: '127.0.0.1',
                port: 41951,
                path: '/DYMO/DLS/Printing/StatusConnected',
                method: 'GET',
                agent: this.httpsAgent,
                timeout: this.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(data.trim() === 'true');
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    // Obtenir la liste des imprimantes DYMO
    async getPrinters(): Promise<PrinterInfo[]> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: '127.0.0.1',
                port: 41951,
                path: '/DYMO/DLS/Printing/GetPrinters',
                method: 'GET',
                agent: this.httpsAgent,
                timeout: this.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const printers = this.parsePrintersXML(data);
                        resolve(printers.filter(p => p.isConnected));
                    } catch (error) {
                        reject(new Error('Erreur lors du parsing des imprimantes: ' + (error as Error).message));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout lors de la récupération des imprimantes'));
            });

            req.end();
        });
    }

    // Parser la réponse XML des imprimantes
    private parsePrintersXML(xmlData: string): PrinterInfo[] {
        const printers: PrinterInfo[] = [];

        // Utiliser une regex pour extraire chaque bloc <LabelWriterPrinter>...</LabelWriterPrinter>
        const printerBlocks = xmlData.match(/<LabelWriterPrinter[^>]*>[\s\S]*?<\/LabelWriterPrinter>/g);

        if (printerBlocks) {
            for (const block of printerBlocks) {
                const nameMatch = block.match(/<Name>(.*?)<\/Name>/);
                const modelMatch = block.match(/<ModelName>(.*?)<\/ModelName>/);
                const isConnectedMatch = block.match(/<IsConnected>(.*?)<\/IsConnected>/);

                if (nameMatch) {
                    const name = nameMatch[1];
                    const model = modelMatch ? modelMatch[1] : '';
                    const isConnected = isConnectedMatch ? isConnectedMatch[1].toLowerCase() === 'true' : false;

                    printers.push({ name, model, isConnected });
                }
            }
        }

        console.log('Parsed printers:', printers);
        return printers;
    }

    // Imprimer une étiquette
    async printLabel(printerName: string, labelXml: string, copies: number = 1): Promise<boolean> {
        return new Promise((resolve, reject) => {
            // Encoder manuellement les paramètres pour éviter les problèmes avec querystring.stringify
            const postData = `printerName=${encodeURIComponent(printerName)}&labelXml=${encodeURIComponent(labelXml)}&labelSetXml=`;

            console.log("DymoAPI.postData length:", postData.length);

            const options = {
                hostname: '127.0.0.1',
                port: 41951,
                path: '/DYMO/DLS/Printing/PrintLabel',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                },
                agent: this.httpsAgent,
                timeout: this.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log(`Response status: ${res.statusCode}, body: ${data.trim()}`);
                    if (res.statusCode === 200) {
                        resolve(data.trim() === 'true');
                    } else {
                        reject(new Error(`Erreur HTTPS ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout lors de l\'impression'));
            });

            req.write(postData);
            req.end();
        });
    }

}
