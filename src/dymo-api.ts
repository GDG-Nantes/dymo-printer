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
                        resolve(printers);
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
        const printerMatches = xmlData.match(/<Name>(.*?)<\/Name>/g);
        const modelMatches = xmlData.match(/<ModelName>(.*?)<\/ModelName>/g);

        if (printerMatches && modelMatches) {
            for (let i = 0; i < printerMatches.length; i++) {
                const name = printerMatches[i].replace(/<\/?Name>/g, '');
                const model = modelMatches[i] ? modelMatches[i].replace(/<\/?ModelName>/g, '') : '';

                printers.push({ name, model });
            }
        }

        return printers;
    }

    // Imprimer une étiquette
    async printLabel(printerName: string, labelXml: string, copies: number = 1): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const postData = querystring.stringify({
                printerName: printerName,
                labelXml: labelXml,
                labelSetXml: ''
            });

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

    // Vérifier le statut d'une imprimante spécifique
    async getPrinterStatus(printerName: string): Promise<PrinterStatus> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: '127.0.0.1',
                port: 41951,
                path: `/DYMO/DLS/Printing/GetPrinterStatus?printerName=${encodeURIComponent(printerName)}`,
                method: 'GET',
                agent: this.httpsAgent,
                timeout: this.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const status = this.parseStatusXML(data);
                        resolve(status);
                    } catch (error) {
                        reject(new Error('Erreur lors du parsing du statut: ' + (error as Error).message));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout lors de la vérification du statut'));
            });

            req.end();
        });
    }

    // Parser le statut XML
    private parseStatusXML(xmlData: string): PrinterStatus {
        const status: PrinterStatus = {
            connected: false,
            ready: false,
            error: null
        };

        try {
            const connectedMatch = xmlData.match(/<Connected>(.*?)<\/Connected>/);
            const readyMatch = xmlData.match(/<Ready>(.*?)<\/Ready>/);
            const errorMatch = xmlData.match(/<ErrorText>(.*?)<\/ErrorText>/);

            if (connectedMatch) {
                status.connected = connectedMatch[1].toLowerCase() === 'true';
            }

            if (readyMatch) {
                status.ready = readyMatch[1].toLowerCase() === 'true';
            }

            if (errorMatch && errorMatch[1].trim()) {
                status.error = errorMatch[1];
            }
        } catch (error) {
            console.warn('Erreur lors du parsing du statut XML:', (error as Error).message);
        }

        return status;
    }
}
